"use client";
import PropTypes from "prop-types";

export function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  const IconCmp = Icon || (() => null);
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="w-16 h-16 rounded-md bg-zinc-100 border center-flex mb-4">
        <IconCmp className="w-8 h-8 text-zinc-500" />
      </div>
      <h3 className="text-lg font-medium text-zinc-700 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 mb-4 max-w-md">{description}</p>
      {action}
    </div>
  );
}
EmptyState.propTypes = {
  icon: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  title: PropTypes.string,
  description: PropTypes.node,
  action: PropTypes.node,
  className: PropTypes.string,
};
