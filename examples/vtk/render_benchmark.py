#!/usr/bin/env -S uv run --script
# /// script
#
# requires-python = ">=3.10"
#
# dependencies = [
#   "trame>=3.13",
#   "trame-vtklocal>=1.3",
#   "vtk>=9.7",
# ]
#
# [[tool.uv.index]]
# url = "https://wheels.vtk.org"
#
# ///
"""Many-actor render benchmark, ported from ../vtk-render-benchmarks.

The scene is a process plant where every piece of equipment is its own ``vtkActor``,
so the renderer does real per-actor work instead of drawing one merged mesh.
Four mappers (cylinder, box, plane, sphere) are shared by every actor
that uses that primitive, so the only per-actor state is the transform and the color.

This demo gives comparable across actor counts:

- Constant triangles per actor.
- Nothing overlaps.

The scene starts at 1000 actors and "+1000 actors" adds a batch, server side,
and pushes the delta to the client. "Orbit" spins the client side camera in a
`requestAnimationFrame` loop and reads back the frame rate.

    python render_benchmark.py                  # wasm64 + WebGL 2
    python render_benchmark.py --webgpu         # wasm64 + WebGPU
    python render_benchmark.py --actors 8000 --step 4000

wasm64 is used because the yard is meant to be grown past what a 4 GiB address
space can mirror: 200k actors of per-actor state is a lot of little objects.
"""

import math
import time

# Required for vtk factory
import vtkmodules.vtkRenderingOpenGL2  # noqa
from vtkmodules.vtkCommonDataModel import vtkPolyData
from vtkmodules.vtkFiltersCore import vtkAppendPolyData
from vtkmodules.vtkFiltersSources import (
    vtkCylinderSource,
    vtkPlaneSource,
    vtkSphereSource,
)
from vtkmodules.vtkInteractionStyle import vtkInteractorStyleSwitch  # noqa
from vtkmodules.vtkRenderingCore import (
    vtkActor,
    vtkLight,
    vtkPolyDataMapper,
    vtkRenderer,
    vtkRenderWindow,
    vtkRenderWindowInteractor,
)

from trame.app import TrameApp
from trame.decorators import change
from trame.ui.html import DivLayout
from trame.widgets import client, html, vtklocal

# -----------------------------------------------------------------------------
# Scene constants (world units)
# -----------------------------------------------------------------------------

STEEL = (0.6, 0.63, 0.67)
DARK = (0.32, 0.34, 0.38)
PIPE = (0.28, 0.5, 0.7)
BEAM = (0.55, 0.38, 0.2)
WHITE = (1.0, 1.0, 1.0)

TRIANGLES_PER_ACTOR = 60
MAX_ACTORS = 200000

TANK_ACTORS = 17  # shell + rim + 10 stanchions + 5 strakes
RACK_ACTORS = 19  # 8 lanes x (pipe + flange) + 3 trestle members

# Footprint radius of the largest unit; the rack, the wider of the two,
# reaches 8.12 from its slot center.
UNIT_RADIUS = 8.5
# Nearest neighbour distance of the lattice, strictly greater than
# 2 * UNIT_RADIUS so two units cannot touch, let alone intersect.
SLOT_PITCH = 18.0
# Half the ground plate's edge, sized once for the largest yard MAX_ACTORS can
# produce: resizing it later would dirty an actor the client already holds.
GROUND_HALF_EXTENT = 1200.0
# Clearance held between any two pieces of equipment, so nothing z-fights.
CLEARANCE = 0.05
# Tallest thing standing on the yard: a tank rim tops out at 21.05.
EQUIPMENT_HEIGHT = 22.0

# -----------------------------------------------------------------------------
# Triangle budget solvers
# -----------------------------------------------------------------------------


def count_triangles(mesh):
    """Triangles a polygonal mesh contributes: an n point polygon is
    n - 2 triangles, this is what webgl/webgpu upload to the GPU."""
    polys = mesh.GetPolys()
    return sum(
        max(polys.GetCellSize(i) - 2, 0) for i in range(polys.GetNumberOfCells())
    )


def detach(output):
    """Detach a source's output from its producer."""
    mesh = vtkPolyData()
    mesh.ShallowCopy(output)
    return mesh


def factor_evenly(count):
    """Finds the largest factor of `count` that is no greater than sqrt(count),
    then pairs it with the corresponding factor which, when multiplied with
    such largest factor gives `count`."""
    a = 1
    candidate = 1
    while candidate * candidate <= count:
        if count % candidate == 0:
            a = candidate
        candidate += 1
    return a, count // a


def solve_cylinder(target):
    for resolution in range(3, 513):
        source = vtkCylinderSource(resolution=resolution, capping=True)
        source.Update()
        triangles = count_triangles(source.GetOutput())
        if triangles == target:
            return detach(source.GetOutput())
        if triangles > target:
            break
    return None


def solve_sphere(target):
    # Prefer the roundest sphere that hits the budget: theta is the equator,
    # phi the pole to pole arc, so twice as many theta steps looks about
    # square. A sphere of (theta, phi) tessellates to theta * (2 * phi - 4)
    # triangles; the candidate that predicts is confirmed on the real mesh.
    best = None
    for phi in range(3, 129):
        band_triangles = 2 * phi - 4
        if band_triangles <= 0 or target % band_triangles:
            continue
        theta = target // band_triangles
        if not 3 <= theta <= 256:
            continue
        source = vtkSphereSource(theta_resolution=theta, phi_resolution=phi)
        source.Update()
        if count_triangles(source.GetOutput()) != target:
            continue
        penalty = abs(theta - 2 * phi)
        if best is None or penalty < best[0]:
            best = (penalty, source.GetOutput())
    return detach(best[1]) if best else None


def solve_plane(target):
    if target % 2:
        return None
    x_resolution, y_resolution = factor_evenly(target // 2)
    source = vtkPlaneSource()
    source.SetResolution(x_resolution, y_resolution)
    source.Update()
    return detach(source.GetOutput())


def solve_box(target):
    """A unit cube whose six faces are each subdivided into a grid of quads.
    vtkCubeSource is fixed at twelve triangles, which is the only reason this
    exists: the box has to carry the same budget as everything else."""
    if target % 12:
        return None
    u_resolution, v_resolution = factor_evenly(target // 12)

    # origin, point1, point2 per face; (point1 - origin) x (point2 - origin) is
    # the outward normal, so the winding puts the faces the right way out.
    faces = [
        ((-0.5, -0.5, 0.5), (0.5, -0.5, 0.5), (-0.5, 0.5, 0.5)),  # +z
        ((-0.5, 0.5, -0.5), (0.5, 0.5, -0.5), (-0.5, -0.5, -0.5)),  # -z
        ((0.5, -0.5, -0.5), (0.5, 0.5, -0.5), (0.5, -0.5, 0.5)),  # +x
        ((-0.5, 0.5, -0.5), (-0.5, -0.5, -0.5), (-0.5, 0.5, 0.5)),  # -x
        ((0.5, 0.5, -0.5), (-0.5, 0.5, -0.5), (0.5, 0.5, 0.5)),  # +y
        ((-0.5, -0.5, -0.5), (0.5, -0.5, -0.5), (-0.5, -0.5, 0.5)),  # -y
    ]

    append = vtkAppendPolyData()
    for origin, point1, point2 in faces:
        source = vtkPlaneSource(origin=origin, point1=point1, point2=point2)
        source.SetResolution(u_resolution, v_resolution)
        append.AddInputConnection(source.output_port)
    append.Update()
    return detach(append.GetOutput())


# -----------------------------------------------------------------------------
# Hexagonal slot lattice
# -----------------------------------------------------------------------------


def ring_of_slot(slot):
    """Ring 0 is the single origin slot and ring r holds 6r slots, so the last
    slot of ring r has index 3r(r + 1)."""
    if slot <= 0:
        return 0
    # Inverting 3r(r + 1) >= slot, then nudged into place: the square root is
    # not to be trusted on the exact ring boundaries.
    ring = max(1, math.ceil((-3.0 + math.sqrt(9.0 + 12.0 * slot)) / 6.0))
    while 3 * ring * (ring + 1) < slot:
        ring += 1
    while ring > 1 and 3 * (ring - 1) * ring >= slot:
        ring -= 1
    return ring


# The six edge directions of a ring, in axial lattice coordinates.
DIRECTIONS = ((1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1))


def slot_center(slot):
    """Center of a lattice slot; neighbours are exactly SLOT_PITCH apart, in
    every direction."""
    if slot <= 0:
        return 0.0, 0.0

    ring = ring_of_slot(slot)
    first = 3 * ring * (ring - 1) + 1
    within = slot - first
    side = within // ring
    step = within % ring

    # The walk starts at (0, -ring) and follows the six edge directions of the
    # ring in turn, `ring` steps along each.
    q, s = 0, -ring
    for completed in range(side):
        q += DIRECTIONS[completed][0] * ring
        s += DIRECTIONS[completed][1] * ring
    q += DIRECTIONS[side][0] * step
    s += DIRECTIONS[side][1] * step

    # Skewed axial basis: both basis vectors, and their difference, have length
    # SLOT_PITCH, which makes the lattice triangular rather than square.
    return SLOT_PITCH * (q + 0.5 * s), SLOT_PITCH * (math.sqrt(3.0) / 2.0) * s


def diameter_for(radius):
    """vtkCylinderSource and vtkSphereSource are half a unit across by default,
    so a scale factor buys half as much world size as it reads. Everything
    below is written in world dimensions and converted here."""
    return 2.0 * radius


# -----------------------------------------------------------------------------
# Scene builder
# -----------------------------------------------------------------------------


class PlantSceneBuilder:
    """Builds the many-actor scene, one actor at a time.

    A batch may stop part way through a unit and resume where it left off on
    the next call: every actor carries the same triangle budget, so a half
    built tank is as valid a scene as a whole one and the requested count is
    always hit exactly.
    """

    def __init__(self, renderer):
        self.renderer = renderer
        self.actor_count = 0
        self.yard_span = 0.0
        # Deterministic PRNG state, so every run builds the same plant.
        self.random_state = 7
        # Lattice slot the next unit will occupy; slot 0 is the origin.
        self.next_slot = 0
        # The unit currently being emitted, so a batch can stop mid unit.
        self.unit = dict(kind="tank", x=0.0, y=0.0, radius=0.0, height=0.0)
        self.emitted = 0
        self.unit_total = 0
        # one mapper per primitive type
        self.mappers = {}
        for name, solver in (
            ("cylinder", solve_cylinder),
            ("box", solve_box),
            ("plane", solve_plane),
            ("sphere", solve_sphere),
        ):
            mesh = solver(TRIANGLES_PER_ACTOR)
            if mesh is None or count_triangles(mesh) != TRIANGLES_PER_ACTOR:
                raise RuntimeError(
                    f"no {name} resolution yields {TRIANGLES_PER_ACTOR} triangles; "
                    "pick a budget that is a multiple of 12 and of the form "
                    "4 * resolution - 4"
                )
            mapper = vtkPolyDataMapper(input_data_object=mesh)
            mapper.SetStatic(True)  # the geometry never changes once built
            self.mappers[name] = mapper

    @property
    def triangle_count(self):
        """Always actor_count * TRIANGLES_PER_ACTOR, by construction."""
        return self.actor_count * TRIANGLES_PER_ACTOR

    def next_random(self):
        # The linear congruential generator of the reference demo, so this and
        # the C++ version lay out the same plant.
        self.random_state = (self.random_state * 1103515245 + 12345) & 0x7FFFFFFF
        return self.random_state / 0x7FFFFFFF

    def add_actor(self, mapper, position, scale, orientation, color):
        actor = vtkActor(
            mapper=self.mappers[mapper],
            position=position,
            scale=scale,
            orientation=orientation,
        )
        actor.property.color = color
        actor.property.specular = 0.4
        actor.property.specular_power = 30.0
        self.renderer.AddActor(actor)
        self.actor_count += 1

    def add_ground(self):
        """The ground is an actor like any other and carries the same triangle
        budget, so it does not perturb the triangles-per-actor invariant. It
        sits just below z = 0, where the equipment stands, so the plate and a
        tank's base are not coplanar."""
        self.add_actor(
            "plane",
            (0.0, 0.0, -CLEARANCE),
            (GROUND_HALF_EXTENT * 2.0, GROUND_HALF_EXTENT * 2.0, 1.0),
            (0.0, 0.0, 0.0),
            WHITE,
        )

    def add_lights(self):
        """Four lights on a ring above and below the yard. These are
        directional (vtkLight is not positional by default), so the radius sets
        a direction and nothing else: it does not grow with the yard."""
        quarter = math.pi * 0.25
        for phi in (-quarter, quarter):
            for theta in (-quarter, quarter):
                light = vtkLight(
                    position=(
                        math.sin(phi) * math.cos(theta),
                        math.sin(phi) * math.sin(theta),
                        math.cos(phi),
                    ),
                    focal_point=(0.0, 0.0, 0.0),
                    intensity=0.8,
                )
                self.renderer.AddLight(light)

    def begin_unit(self):
        slot = self.next_slot
        self.next_slot += 1
        x, y = slot_center(slot)

        # Alternating by slot index keeps the yard mixed without any book
        # keeping that would make the equipment mix depend on the actor count.
        kind = "rack" if slot % 3 == 1 else "tank"
        self.unit_total = TANK_ACTORS if kind == "tank" else RACK_ACTORS
        self.emitted = 0

        # Drawn once per unit rather than once per actor, so a unit split
        # across two batches comes out the same shape as one built in a single
        # batch. The shell radius is bounded so the widest tank still fits
        # inside UNIT_RADIUS once its stanchions and brackets are hung on it.
        self.unit = dict(
            kind=kind,
            x=x,
            y=y,
            radius=2.5 + self.next_random() * 1.5,  # <= 4.0
            height=9.0 + self.next_random() * 11.0,  # <= 20.0
        )

        # Radius of the occupied yard: the outermost ring in use plus the reach
        # of a unit sitting on it. This is what the camera has to stand back
        # from, and it grows as sqrt(actors) because a ring holds 6r slots.
        self.yard_span = SLOT_PITCH * ring_of_slot(slot) + UNIT_RADIUS

    def emit_tank_actor(self, index):
        """A storage tank: a shell standing on the yard, a rim floating just
        clear of its roof, ten stanchions ringing it and five access platform
        brackets hung between them."""
        stanchions = 10
        brackets = 5
        stanchion_width = 0.35
        bracket_width = 0.7
        bracket_height = 0.3
        # Half diagonals: an axis aligned square of side w reaches this far
        # from its center, which is what has to clear the shell.
        stanchion_reach = stanchion_width * 0.7071067811865476
        bracket_reach = bracket_width * 0.7071067811865476

        x = self.unit["x"]
        y = self.unit["y"]
        radius = self.unit["radius"]
        height = self.unit["height"]

        if index == 0:  # shell, standing on z = 0
            self.add_actor(
                "cylinder",
                (x, y, height / 2.0),
                (diameter_for(radius), height, diameter_for(radius)),
                (90.0, 0.0, 0.0),
                STEEL,
            )
        elif index == 1:  # rim, clear of the roof rather than resting on it
            self.add_actor(
                "cylinder",
                (x, y, height + 0.5 + CLEARANCE),
                (
                    diameter_for(radius * 1.12),
                    1.0,
                    diameter_for(radius * 1.12),
                ),
                (90.0, 0.0, 0.0),
                DARK,
            )
        elif index < 2 + stanchions:
            # Set out far enough that even the corner of the square section
            # stays off the shell. Neighbours are 36 degrees apart, which at
            # this radius is a chord of at least 1.7 against a 0.5 diagonal.
            angle = ((index - 2) / stanchions) * math.pi * 2.0
            distance = radius + stanchion_reach + CLEARANCE
            self.add_actor(
                "box",
                (
                    x + math.cos(angle) * distance,
                    y + math.sin(angle) * distance,
                    height / 2.0,
                ),
                (stanchion_width, stanchion_width, height),
                (0.0, 0.0, 0.0),
                DARK,
            )
        else:
            # Half a stanchion step round, so the brackets sit in the gaps
            # rather than on top of the uprights, and low enough that the
            # topmost stays under the roof line.
            s = index - (2 + stanchions)
            angle = (0.5 + s * stanchions / brackets) * (math.pi * 2.0 / stanchions)
            distance = radius + bracket_reach + CLEARANCE
            self.add_actor(
                "box",
                (
                    x + math.cos(angle) * distance,
                    y + math.sin(angle) * distance,
                    (height * (s + 1)) / (brackets + 1),
                ),
                (bracket_width, bracket_width, bracket_height),
                (0.0, 0.0, 0.0),
                DARK,
            )

    def emit_rack_actor(self, index):
        """A pipe rack: eight pipe lanes stacked up the trestle, each capped
        with a flange, on a header beam slung under the lowest lane between two
        posts. The beam sits below the pipes and stops short of the posts, so
        nothing passes through anything else."""
        lanes = 8
        pipe_radius = 0.275
        pipe_half_length = 7.0
        flange_radius = 0.4
        lowest_lane = 3.0
        lane_rise = 2.2
        post_width = 1.2
        post_offset = 7.5
        beam_width = 1.4

        x = self.unit["x"]
        y = self.unit["y"]

        # The rack is the wider of the two units: a post corner reaches 8.12
        # from the slot center, which is what UNIT_RADIUS is sized against.
        if index < 2 * lanes:
            z = lowest_lane + (index // 2) * lane_rise
            if index % 2 == 0:  # pipe, laid along x by the 90 degree roll
                self.add_actor(
                    "cylinder",
                    (x, y, z),
                    (
                        diameter_for(pipe_radius),
                        2.0 * pipe_half_length,
                        diameter_for(pipe_radius),
                    ),
                    (0.0, 0.0, 0.0),
                    PIPE,
                )
            else:  # flange, just off the pipe's far end
                self.add_actor(
                    "sphere",
                    (x, y, z),
                    (
                        diameter_for(flange_radius),
                        diameter_for(flange_radius),
                        diameter_for(flange_radius),
                    ),
                    (0.0, 0.0, 0.0),
                    DARK,
                )
        elif index == 2 * lanes:  # header beam, under the lowest lane
            clear_height = lowest_lane - pipe_radius - beam_width / 2.0 - CLEARANCE
            # Stops short of the posts on both sides.
            length = 2.0 * (post_offset - post_width / 2.0 - CLEARANCE)
            self.add_actor(
                "box",
                (x, y, clear_height),
                (beam_width, length, beam_width),
                (0.0, 0.0, 0.0),
                BEAM,
            )
        else:  # the two posts it is slung between, clear of every pipe in y
            height = lowest_lane + (lanes - 1) * lane_rise + 2.0
            side = -1.0 if index == 2 * lanes + 1 else 1.0
            self.add_actor(
                "box",
                (x, y + side * post_offset, height / 2.0),
                (post_width, post_width, height),
                (0.0, 0.0, 0.0),
                BEAM,
            )

    def add_batch(self, count):
        """Add exactly `count` actors, or as many as MAX_ACTORS allows. Returns
        the new total."""
        remaining = count
        while remaining > 0 and self.actor_count < MAX_ACTORS:
            if self.emitted == self.unit_total:
                self.begin_unit()

            index = self.emitted
            self.emitted += 1
            if self.unit["kind"] == "tank":
                self.emit_tank_actor(index)
            else:
                self.emit_rack_actor(index)
            remaining -= 1

        return self.actor_count

    def frame_yard(self, camera):
        """Point the camera at the yard as it currently stands."""
        span = max(self.yard_span, EQUIPMENT_HEIGHT)

        camera.SetViewUp(0.0, 0.0, 1.0)
        # Direction only: ResetCamera keeps the view direction and works out
        # the distance that fits the bounds, which is what makes the framing
        # track sqrt(actors) on its own and keeps every actor inside the
        # frustum. The renderer's default frustum culler would otherwise drop
        # the actors that fell outside it.
        camera.SetFocalPoint(0.0, 0.0, 0.0)
        camera.SetPosition(-1.0, -1.0, 0.62)

        # The yard, not the scene: the ground plate is sized for the largest
        # yard MAX_ACTORS can reach, so framing every prop would zoom out to
        # it. ResetCamera fits the bounding *sphere* of what it is given, so
        # the box passed here is the one whose half diagonal is the yard's own
        # radius; a box of +/- span would stand the camera back sqrt(2) too far.
        half = span / math.sqrt(2.0)
        self.renderer.ResetCamera(-half, half, -half, half, 0.0, EQUIPMENT_HEIGHT)
        # This one does look at every prop, so the ground plate stays out of
        # the near and far planes' way.
        self.renderer.ResetCameraClippingRange()


# -----------------------------------------------------------------------------
# GUI
# -----------------------------------------------------------------------------

FULL_SCREEN = "position:absolute; left:0; top:0; width:100vw; height:100vh;"
PANEL = (
    "position:absolute; z-index:10; background:rgba(255,255,255,0.92);"
    "padding:0.75rem 1rem; border-radius:0.5rem;"
    "font-family:monospace; font-size:0.8rem;"
)
TOP_LEFT = PANEL + "top:1rem; left:1rem;"
TOP_RIGHT = PANEL + "top:1rem; right:1rem; display:flex; gap:0.5rem;"

# Spins the client side camera and reads the frame rate back.
ORBIT_SCRIPT = """
async function plantOrbit(refName, cameraId, azimuth, run) {
    const bench = (window.__plantBench = window.__plantBench || { running: false });
    if (!run) {
        bench.running = false;
        return;
    }
    if (bench.running) {
        return;
    }
    const view = window.trame.refs[refName];
    if (!view) {
        return;
    }

    bench.running = true;
    const camera = view.getVtkObject(cameraId);
    const readout = document.getElementById("bench-fps");
    let smoothed = 0;
    let last = performance.now();
    let lastReport = last;

    try {
        while (bench.running) {
            // The camera is driven inside the wasm runtime: no state and no
            // blob travels over the wire while the loop runs.
            camera.azimuth(azimuth);
            view.render();
            await new Promise(requestAnimationFrame);

            const now = performance.now();
            const instant = 1000 / Math.max(now - last, 0.001);
            last = now;
            // Exponential moving average: raw per-frame numbers are far too
            // jittery to read off a HUD.
            smoothed = smoothed === 0 ? instant : smoothed * 0.9 + instant * 0.1;
            if (now - lastReport >= 100) {
                lastReport = now;
                if (readout) {
                    readout.textContent = smoothed.toFixed(1);
                }
            }
        }
    } catch (err) {
        bench.running = false;
        console.error("Orbit failed", err);
    }
}"""


class BenchmarkApp(TrameApp):
    def __init__(self, server=None):
        super().__init__(server)

        self.server.cli.add_argument(
            "--actors",
            type=int,
            default=1000,
            help="Actors the scene starts with (default: 1000)",
        )
        self.server.cli.add_argument(
            "--step",
            type=int,
            default=1000,
            help="Actors added per button press (default: 1000)",
        )
        self.server.cli.add_argument(
            "--azimuth",
            type=float,
            default=0.25,
            help="Degrees the orbit turns the camera per frame (default: 0.25)",
        )
        self.server.cli.add_argument(
            "--webgpu",
            action="store_true",
            help="Render with WebGPU instead of WebGL 2",
        )
        args, _ = self.server.cli.parse_known_args()

        self.step = args.step
        self.azimuth = args.azimuth
        self.rendering = "webgpu" if args.webgpu else "webgl"

        self.renderer = vtkRenderer(background=(0.05, 0.06, 0.08))
        self.render_window = vtkRenderWindow()
        self.render_window.AddRenderer(self.renderer)
        interactor = vtkRenderWindowInteractor(render_window=self.render_window)
        interactor.interactor_style.SetCurrentStyleToTrackballCamera()

        self.builder = PlantSceneBuilder(self.renderer)
        self.builder.add_ground()
        self.builder.add_lights()
        # The ground counts against the target the scene holds exactly `--actors` actors.
        self.builder.add_batch(max(0, args.actors - self.builder.actor_count))
        self.builder.frame_yard(self.renderer.GetActiveCamera())

        self.state.update(
            dict(
                actor_count=self.builder.actor_count,
                triangle_count=self.builder.triangle_count,
                build_ms=0,
                sync_ms=0,
                mem_vtk=0,
                orbit=False,
                rendering=self.rendering,
            )
        )

        self.html_view = None
        self._sync_start = None
        self._orbit_suspended = (
            False  # Set when user bumps actor count while camera orbit is active.
        )
        self._build_ui()

    def add_actors(self):
        # A render loop running against a scene the client is deserializing
        # would draw half applied states, so the orbit stops first.
        if self.state.orbit:
            self._orbit_suspended = True
            self.state.orbit = False
            self.state.flush()

        start = time.time()
        self.builder.add_batch(self.step)
        self.builder.frame_yard(self.renderer.GetActiveCamera())
        self.state.build_ms = round((time.time() - start) * 1000)
        self.state.actor_count = self.builder.actor_count
        self.state.triangle_count = self.builder.triangle_count

        # The camera moved with the yard, so it has to go over with the actors.
        self._sync_start = time.time()
        self.html_view.update(push_camera=True)

    def _on_updated(self, options=None, **_):
        """Fires when the client has applied the whole batch: states pulled,
        blobs fetched, objects deserialized. That round trip, not the server
        side build, is what a bigger scene actually costs here."""
        if self._sync_start is None:
            return
        self.state.sync_ms = round((time.time() - self._sync_start) * 1000)
        self._sync_start = None

        if self._orbit_suspended:
            self._orbit_suspended = False
            self.state.orbit = True
            self.state.flush()

    def reset_camera(self):
        self.builder.frame_yard(self.renderer.GetActiveCamera())
        self.html_view.update(push_camera=True)

    @change("orbit")
    def on_orbit(self, orbit, **_):
        self.ctrl.js_orbit(
            {
                "ref": self.html_view.ref_name,
                "camera": self.html_view.get_wasm_id(self.renderer.GetActiveCamera()),
                "azimuth": self.azimuth,
                "run": bool(orbit),
            }
        )

    def _build_ui(self):
        with DivLayout(self.server) as self.ui:
            client.Style("body { margin: 0; }")
            with html.Div(style=FULL_SCREEN):
                self.html_view = vtklocal.LocalView(
                    self.render_window,
                    throttle_rate=20,
                    # wasm64: growing the yard past a few tens of thousands of
                    # actors mirrors more per-actor state than a 4 GiB address
                    # space holds.
                    config=(f"{{ mode: 'wasm64', rendering: '{self.rendering}' }}",),
                    progress_enabled=True,
                    progress_delay=100,
                    emit_memory=True,
                    memory_vtk="mem_vtk = $event",
                    updated=(self._on_updated, "[$event]"),
                )

            client.Script(ORBIT_SCRIPT)
            self.ctrl.js_orbit = client.JSEval(
                exec="utils.get('plantOrbit')("
                "$event.ref, $event.camera, $event.azimuth, $event.run)",
            ).exec

            html.Div(
                "{{ actor_count.toLocaleString() }} actors &middot; "
                "{{ triangle_count.toLocaleString() }} triangles<br>"
                "build {{ build_ms }} ms &middot; sync {{ sync_ms }} ms &middot; "
                "geometry {{ (mem_vtk / 1024).toFixed(1) }} KB<br>"
                "wasm64/{{ rendering }} &middot; "
                "<span id='bench-fps'>--</span> fps",
                style=TOP_LEFT,
            )
            with html.Div(style=TOP_RIGHT):
                html.Button(f"+{self.step} actors", click=self.add_actors)
                html.Button(
                    "{{ orbit ? 'Stop orbit' : 'Orbit' }}",
                    click="orbit = !orbit",
                )
                html.Button("Reset Camera", click=self.reset_camera)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = BenchmarkApp()
    app.server.start()
