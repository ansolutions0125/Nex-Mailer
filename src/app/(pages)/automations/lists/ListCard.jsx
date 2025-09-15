"use client";
import { useState } from "react";
import { FiEdit, FiTrash2, FiCopy } from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { EthernetPortIcon } from "lucide-react";
import { Dropdown } from "@/components/Dropdown";
import { MiniCard } from "@/presets/styles";

const ListCard = ({
  list,
  websites,
  automations,
  onEdit,
  onDelete,
  isSelected,
  onSelect,
  isDeleting,
  viewMode,
}) => {
  const associatedWebsite = websites.find((w) => w._id === list.websiteId);
  const associatedAutomation = automations.find(
    (a) => a._id === list.automationId
  );

  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };


  return (
    <div
      className={`rounded border transition-all duration-200 gap-6 p-6 relative ${
        isSelected
          ? "bg-zinc-50 border-y-2 border-primary"
          : "bg-zinc-50 hover:border-zinc-300"
      }`}
    >
      {isSelected && (
        <div className="absolute -top-3 right-1 bg-primary text-white text-xs px-2 py-1 rounded uppercase tracking-wider transition-all">
          Selected
        </div>
      )}
      
      {/* Selection checkbox */}
      {onSelect && (
        <div className="absolute top-4 right-4 z-10">
          <div
            onClick={() => onSelect(list._id)}
            className={`w-6 h-6 rounded border cursor-pointer transition-all duration-200 flex items-center justify-center
              ${
                isSelected
                  ? "bg-primary border-primary"
                  : "border-zinc-300 hover:border-primary"
              }`}
          >
            {isSelected && (
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      <div
        className={`${
          viewMode === "double"
            ? "flex flex-col items-start"
            : "flex items-start xl:items-center flex-col xl:flex-row xl:justify-between"
        } gap-6`}
      >
        <div className="flex flex-col xl:flex-row items-center gap-3 md:gap-5 xl:divide-x">
          <div className="bg-zinc-100 border rounded-md overflow-hidden w-full max-w-28 h-32">
            {list.logo ? (
              <img
                src={list.logo}
                alt={`${list.name} logo`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://placehold.co/80x80/efefef/999999?text=${list.name
                    .charAt(0)
                    .toUpperCase()}`;
                }}
              />
            ) : (
              <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
                <EthernetPortIcon className="text-zinc-400 w-8 h-8" />
              </div>
            )}
          </div>
          <div className="flex flex-col xl:pl-4">
            <div
              className={`w-fit text-xxs px-2 py-0.5 rounded border ${
                list.isActive
                  ? "bg-green-200 border-green-500 text-zinc-800"
                  : "bg-red-200 border-red-500 text-red-900"
              }`}
            >
              {list.isActive ? "Currently Active" : "Currently Inactive"}
            </div>
            <h2 className="text-lg text-zinc-700 font-medium mt-1">
              {list.name}
            </h2>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                <div className="flex items-center gap-1">
                  <h2 className="text-xxs uppercase text-primary">
                    {associatedWebsite ? "Website" : "Not Connected"} :
                  </h2>
                  <p className="text-xs text-zinc-600">{`${
                    associatedWebsite ? "Connected" : "None"
                  }`}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 border border-zinc-200 p-1 px-2 rounded bg-zinc-50">
                <div className="flex items-center gap-1">
                  <h2 className="text-xxs uppercase text-primary">
                    {associatedAutomation?.name ? "Automation" : "Not Connected"} :
                  </h2>
                  <p className="text-xs text-zinc-600">{`${
                    associatedAutomation ? "Connected" : "None"
                  }`}</p>
                </div>
              </div>
            </div>
            <Dropdown
              position="bottom"
              options={[
                {
                  value: "edit",
                  label: (
                    <div className="flex items-center gap-2 w-full">
                      <FiEdit />
                      Edit List
                    </div>
                  ),
                },
                {
                  value: "copy",
                  label: (
                    <div className="flex items-center gap-2 w-full">
                      <FiCopy />
                      Copy List Id
                    </div>
                  ),
                },
                {
                  value: "delete",
                  label: (
                    <div className="flex items-center gap-2 w-full">
                      {isDeleting ? (
                        <ImSpinner5 className="animate-spin" />
                      ) : (
                        <FiTrash2 />
                      )}
                      Delete List
                    </div>
                  ),
                },
              ]}
              placeholder="Actions Menu"
              onChange={(val) => {
                if (val === "edit") onEdit(list);
                if (val === "delete") onDelete(list);
                if (val === "copy") navigator.clipboard.writeText(list._id);
              }}
              disabled={isDeleting}
              className="w-48"
            />
          </div>
        </div>

        <div
          className={`flex-1 w-full grid gap-3 ${
            viewMode === "double" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-4"
          }`}
        >
          <MiniCard
            title="Total Subscribers"
            subLine={list?.stats?.totalSubscribers || 0}
          />
          <MiniCard title="Added On" subLine={formatDate(list.createdAt)} />
          <MiniCard title="Last Updated" subLine={formatDate(list.updatedAt)} />
        </div>
      </div>
    </div>
  );
};

export default ListCard;