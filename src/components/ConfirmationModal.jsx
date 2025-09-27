// components/ConfirmationModal.jsx
import React from "react";

const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 w-full h-screen bg-black/50 backdrop-blur-sm center-flex z-50 p-4">
      <div className="bg-white border border-zinc-200 w-full max-w-md shadow-xl rounded">
        <div className="p-5 border-b border-zinc-200">
          <h2 className="text-xl font-medium text-primary">{title}</h2>
        </div>
        <div className="p-5 text-zinc-700">
          <p>{message}</p>
        </div>
        <div className="p-5 border-t border-zinc-200 flex justify-end gap-2">
          <button onClick={onCancel} className="btn btn-md hover:bg-zinc-200">
            {cancelText}
          </button>
          <button onClick={onConfirm} className="btn btn-md btn-delete">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
