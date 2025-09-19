"use client";
import PropTypes from "prop-types";
import { RxDragHandleVertical } from "react-icons/rx";
import { FiClock, FiZap, FiLink2, FiTrash2, FiEdit2 } from "react-icons/fi";

const icons = {
  delay: <FiClock className="w-4 h-4" />,
  action: <FiZap className="w-4 h-4" />,
  default: <FiLink2 className="w-4 h-4" />,
};

export default function StepCard({
  step,
  count,
  onEdit,
  onDelete,
  onDragStartReorder,
  canDropInline,
  onInlineDragOver,
  onInlineDrop,
}) {
  const kind = step?.type === "delay" ? "delay" : step?.type === "action" ? "action" : "default";

  return (
    <div className="w-full flex gap-3 group">
      <div className="flex-1 overflow-hidden rounded-md border bg-white transition-all duration-200 border-zinc-200">
        <div className="flex border-b border-zinc-200">
          <div
            className="w-10 p-2 bg-white center-flex cursor-grab active:cursor-grabbing select-none transition-all hover:bg-zinc-50 hover:border-zinc-300 border-r border-zinc-200"
            draggable
            onDragStart={onDragStartReorder}
            title="Drag to reorder"
            aria-label="Drag handle"
            tabIndex={0}
          >
            <RxDragHandleVertical className="w-full h-full text-primary" />
          </div>

          <div className="w-full flex-1 p-2 between-flex gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-10 rounded-sm bg-second text-white center-flex">
                {icons[kind] || icons.default}
              </div>
              <span className="text-sm md:text-base text-zinc-800 truncate font-medium">
                {step?.data?.title || "Untitled step"}
              </span>
            </div>
          </div>
          <div className="w-10 p-2 bg-white text-primary center-flex flex-col border-l border-zinc-200 font-medium">
            {count}
            <span className="text-xxs">Step</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-3.5 text-xs">
          {step?.type === "delay" && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded text-xs bg-sky-100 border border-sky-400 uppercase">
                Delay
              </span>
              <span className="text-zinc-700">
                <span className="text-zinc-900 font-semibold">{step?.data?.amount}</span>{" "}
                {step?.data?.unit}
              </span>
            </div>
          )}

          {step?.type === "action" && (
            <>
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 mb-3">
                <span className="px-2 py-1 rounded text-xs bg-sky-100 border border-sky-400 uppercase">
                  Action
                </span>
                <span className="text-sm text-zinc-700">
                  {step?.data?.actionKind?.replaceAll("_", " ")}
                </span>
              </div>
              {/* keep compact; details are editable in modal */}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200">
          <button className="btn btn-xs btn-primary" onClick={onEdit}>
            <FiEdit2 /> Edit
          </button>
          <button
            className="btn btn-xs border border-zinc-400 text-zinc-700 center-flex gap-1 rounded hover:bg-red-500 hover:text-white"
            onClick={onDelete}
          >
            <FiTrash2 /> Delete
          </button>
        </div>
      </div>

      {/* Inline drop rail (optional) */}
      <div
        className={`h-auto w-1/4 shrink-0 transition-all duration-200 rounded-lg ${
          canDropInline ? "border-[2px] border-dashed border-zinc-300" : "opacity-0"
        }`}
        onDragOver={canDropInline ? onInlineDragOver : undefined}
        onDrop={canDropInline ? onInlineDrop : undefined}
        title={canDropInline ? "Drop here to place BEFORE this step" : ""}
        aria-label="Drop zone"
      />
    </div>
  );
}

StepCard.propTypes = {
  step: PropTypes.object.isRequired,
  count: PropTypes.number.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onDragStartReorder: PropTypes.func.isRequired,
  canDropInline: PropTypes.bool,
  onInlineDragOver: PropTypes.func,
  onInlineDrop: PropTypes.func,
};
