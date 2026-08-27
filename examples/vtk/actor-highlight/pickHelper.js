let pickingInitialized = false;
let pickPending = false;
let lastActor = null;

async function pick(xyz, picker, renderwindow, renderer, prop) {
    if (pickPending) {
        return;
    }
    try {
        pickPending = true;
        const found = await picker.pick(xyz, renderer);
        if (found) {
            if (lastActor) {
              (await lastActor.getProperty()).deepCopy(prop);
              lastActor = null;
            }
            lastActor = await picker.getActor();
            const actorProp = await lastActor.getProperty();
            await prop.deepCopy(actorProp);
            await actorProp.setColor(1, 0, 1);
            await actorProp.edgeVisibilityOn();
        }
        await renderwindow.render();
    } finally {
        pickPending = false;
    }
}

function setupJSPicking(refName, interactorId, pickerId, renderWindowId, rendererId, propId) {
    if (pickingInitialized) {
        return;
    }
    pickingInitialized = true;
    const getVtkObject = window.trame.refs[refName].getVtkObject;
    const interactor = getVtkObject(interactorId);
    const picker = getVtkObject(pickerId);
    const renderer = getVtkObject(rendererId);
    const renderWindow = getVtkObject(renderWindowId);
    const prop = getVtkObject(propId);

    interactor.$observe("MouseMoveEvent", async () => {
          const pos = await interactor.getEventPosition();
          await pick([pos[0], pos[1], 0], picker, renderWindow, renderer, prop);
    });
}
