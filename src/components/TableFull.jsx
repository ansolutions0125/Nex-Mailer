"use client";
import React from "react";
import { EmptyState, LoadingSpinner } from "@/presets/styles";

export default function TableFull({
  columns, // required
  data, // required
  loading = false,
  emptyPlaceholder = <EmptyState />,
  rowKey = (row) => row._id,
  onRowClick,
  extraHeaderContent = null, // react-node shown in thead after columns
  className = "",
}) {
  if (loading) return <LoadingSpinner />;
  if (!data || data.length === 0) return emptyPlaceholder;

  return (
    <div className="w-full min-h-96 overflow-x-auto rounded">
      <table
        className={`w-full min-w-[64rem] text-sm text-left text-zinc-700 border border-zinc-200 rounded ${className}`}
      >
        <thead className="bg-zinc-50 border-b-2 border-zinc-200 text-xs uppercase text-zinc-600">
          <tr>
            {columns.map((col) => (
              <th
                key={col.accessor}
                className={`px-3 py-2 font-medium ${col.headerClassName || ""}`}
              >
                {col.header}
              </th>
            ))}
            {extraHeaderContent && (
              <th className="px-3 py-2">{extraHeaderContent}</th>
            )}
          </tr>
        </thead>

        <tbody>
          {data.map((row, idx) => (
            <tr
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b hover:bg-zinc-50 transition-colors font-[400] text-zinc-500 text-xs align-middle`}
            >
              {columns.map((col) => (
                <td
                  key={col.accessor}
                  className={`px-3 py-2 ${col.cellClassName || ""}`}
                >
                  {col.render
                    ? col.render(row[col.accessor], row)
                    : row[col.accessor]}
                </td>
              ))}
              {extraHeaderContent && (
                <td className="px-3 py-2">{extraHeaderContent}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
