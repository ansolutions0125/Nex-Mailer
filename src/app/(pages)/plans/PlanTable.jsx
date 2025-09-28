"use client";

import React from "react";
import { Checkbox, EmptyState, LoadingSpinner } from "@/presets/styles";
import { Dropdown } from "@/components/Dropdown";
import { FiPackage } from "react-icons/fi";

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(new Date(dateString));
  } catch (e) {
    return dateString; // Fallback to original string if formatting fails
  }
};

const PlanTable = ({
  plans,
  selected,
  onSelect,
  onBulkToggle,
  onAction,
  loading,
  openDetailsModal,
}) => {
  if (loading) {
    return <LoadingSpinner />;
  }

  if (!plans || plans.length === 0) {
    return <EmptyState />;
  }

  const allSelected =
    plans.length > 0 && plans.every((p) => selected.includes(p._id));

  return (
    <div className="w-full min-h-80 overflow-x-auto rounded">
      <table className="w-full min-w-[64rem] text-sm text-left text-zinc-700 border border-zinc-200 rounded">
        <thead className="bg-zinc-50 border-b-2 border-zinc-200 text-xs uppercase text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-medium w-10">
              <Checkbox selected={allSelected} onChange={onBulkToggle} />
            </th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Length</th>
            <th className="px-3 py-2 font-medium">Price</th>
            <th className="px-3 py-2 font-medium">Email Limit</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Created At</th>
            <th className="px-3 py-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => {
            const effPrice =
              typeof p.effectivePrice === "number" ? p.effectivePrice : p.price;
            return (
              <tr
                key={p._id}
                className="border-b hover:bg-zinc-50 transition-colors font-[400] text-zinc-500 text-xs align-middle"
              >
                <td className="px-3 py-2">
                  <Checkbox
                    selected={selected.includes(p._id)}
                    onChange={() => onSelect(p._id)}
                  />
                </td>
                <td
                  onClick={() => openDetailsModal(p)}
                  className="px-3 py-2 flex items-center gap-2 cursor-pointer text-sm"
                >
                  <div className="w-10 h-10 p-2 center-flex rounded bg-zinc-50 border border-zinc-200">
                    <FiPackage className="w-full h-full" />
                  </div>
                  <div className="flex flex-col">
                    <span className="hover:underline hover:text-zinc-600">
                      {p.name}
                    </span>
                    <span className="text-[0.675rem] text-zinc-500">
                      Slogon: {p.slogan}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 uppercase">{p.length}</td>
                <td className="px-3 py-2">{effPrice.toLocaleString()}</td>
                <td className="px-3 py-2">
                  {typeof p.emailLimit === "number"
                    ? p.emailLimit.toLocaleString()
                    : "0"}
                </td>
                <td className="px-3 py-2">
                  {p.isActive ? (
                    <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{formatDate(p.createdAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end">
                    <Dropdown
                      options={[
                        { value: "edit", label: "Edit Plan" },
                        { value: "delete", label: "Delete Plan" },
                        {
                          value: p.isActive ? "disable" : "enable",
                          label: p.isActive ? "Disable" : "Enable",
                        },
                      ]}
                      onChange={(val) => onAction(val, p)}
                      placeholder="Actions"
                      position="bottom-right"
                      className="w-32"
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PlanTable;
