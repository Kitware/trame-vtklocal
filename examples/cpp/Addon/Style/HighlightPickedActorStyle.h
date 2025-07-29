// SPDX-FileCopyrightText: Copyright (c) Ken Martin, Will Schroeder, Bill Lorensen
// SPDX-License-Identifier: BSD-3-Clause

#pragma once

#include "addonStyleModule.h"

#include <vtkInteractorStyleTrackballCamera.h>
#include <vtkNew.h>
#include <vtkWrappingHints.h>

class vtkActor;
class vtkProperty;

class ADDONSTYLE_EXPORT VTK_MARSHALAUTO HighlightPickedActorStyle
  : public vtkInteractorStyleTrackballCamera
{
public:
  static HighlightPickedActorStyle* New();
  vtkTypeMacro(HighlightPickedActorStyle, vtkInteractorStyleTrackballCamera);
  void PrintSelf(ostream& os, vtkIndent indent) override;

  void OnLeftButtonDown() override;

protected:
  HighlightPickedActorStyle();
  ~HighlightPickedActorStyle() override;

private:
  HighlightPickedActorStyle(const HighlightPickedActorStyle&) = delete;
  void operator=(const HighlightPickedActorStyle&) = delete;

  vtkActor* LastPickedActor = nullptr;
  vtkNew<vtkProperty> LastPickedProperty;
};
