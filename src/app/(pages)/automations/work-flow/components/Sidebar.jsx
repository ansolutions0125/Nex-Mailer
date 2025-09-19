"use client";
import PropTypes from "prop-types";
import { useState } from "react";

function PaletteItem({
  label,
  description,
  draggableType,
  preset,
  onDragStart,
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, draggableType, preset)}
      className="w-full text-left rounded-md bg-second hover:bg-white/20 transition-all p-3 cursor-grab active:cursor-grabbing"
      title="Drag to canvas"
    >
      <div className="text-sm font-medium text-white border-b-2 border-white/20 pl-1 pb-1 mb-2">
        {label}
      </div>
      {description && (
        <div className="text-xs text-zinc-300 mt-1 pl-1">{description}</div>
      )}
    </div>
  );
}

export default function Sidebar({ onAddDragStart, isOpen, setIsOpen }) {
  return (
    <>
      {/* Sidebar */}
      <aside
        className={`
          h-full overflow-y-auto bg-primary text-white transition-transform duration-300 ease-in-out z-20
          lg:relative lg:translate-x-0 lg:rounded-r-lg
          fixed top-0 left-0 w-80 ${
            isOpen ? "translate-x-0" : "-translate-x-full "
          }
        `}
      >
        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-sm md:text-base font-semibold text-white mb-1">
              Actions
            </h3>
            <p className="text-xs text-zinc-200 mb-3">
              Drag to canvas → configure → Save.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <PaletteItem
                label="Send Mail"
                draggableType="action"
                description="Template or custom HTML"
                preset={{ title: "Send Mail", actionKind: "send_email" }}
                onDragStart={onAddDragStart}
              />
              <PaletteItem
                label="Outgoing Request"
                draggableType="action"
                description="HTTP request to your API"
                preset={{
                  title: "Outgoing Request",
                  actionKind: "http_request",
                  method: "POST",
                }}
                onDragStart={onAddDragStart}
              />
              <PaletteItem
                label="Move to targeted list"
                draggableType="action"
                description="Move subscriber to another list"
                preset={{
                  title: "Move to targeted list",
                  actionKind: "move_to_list",
                }}
                onDragStart={onAddDragStart}
              />
              <PaletteItem
                label="Delete from current list"
                draggableType="action"
                description="Remove subscriber from this list"
                preset={{
                  title: "Delete from current list",
                  actionKind: "delete_from_current_list",
                }}
                onDragStart={onAddDragStart}
              />
              <PaletteItem
                label="Delete subscriber"
                draggableType="action"
                description="Permanently delete the subscriber"
                preset={{
                  title: "Delete subscriber",
                  actionKind: "delete_subscriber",
                }}
                onDragStart={onAddDragStart}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm md:text-base font-semibold text-white mb-1">
              Delays
            </h3>
            <p className="text-xs text-zinc-200 mb-3">Pause the flow.</p>
            <div className="grid grid-cols-1 gap-2">
              <PaletteItem
                label="Wait"
                draggableType="delay"
                description="seconds/minutes/hours/days…"
                preset={{ title: "Wait", amount: 3, unit: "minutes" }}
                onDragStart={onAddDragStart}
              />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

Sidebar.propTypes = { onAddDragStart: PropTypes.func.isRequired };
