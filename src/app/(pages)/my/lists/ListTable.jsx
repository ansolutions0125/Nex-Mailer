"use client";

import { Checkbox } from "@/presets/styles";
import { FiChevronUp, FiChevronDown, FiEye, FiEdit, FiCopy, FiTrash2 } from "react-icons/fi";
import { Dropdown } from "@/components/Dropdown";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Small table kit – keep it here so ListTable is self-sufficient    */
/* ------------------------------------------------------------------ */
const Table = ({ children, className = "" }) => (
  <div
    className={`w-full min-h-96 bg-white border border-zinc-200 rounded overflow-auto ${className}`}
  >
    {children}
  </div>
);

const TableHeader = ({ children, className = "" }) => (
  <div className={`w-full bg-zinc-50 border-b border-zinc-200 text-xs uppercase ${className}`}>
    {children}
  </div>
);

const TableRow = ({ children, className = "", isSelected = false, onClick }) => (
  <div
    className={`border-b border-zinc-100 transition-all ${
      isSelected ? "bg-blue-50" : ""
    } ${className}`}
    onClick={onClick}
  >
    {children}
  </div>
);

const TableCell = ({ children, className = "", colSpan = 1, onClick }) => (
  <div
    className={`p-3 ${className}`}
    style={{ gridColumn: `span ${colSpan}` }}
    onClick={onClick}
  >
    {children}
  </div>
);

const TableBody = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);

/* ------------------------------------------------------------------ */
/*  Presentational component                                           */
/* ------------------------------------------------------------------ */
export default function ListTable({
  lists = [],               // required: array of list objects
  selectedIds = [],         // required: array of selected _ids
  sortConfig = {},          // required: { key, direction }
  onSort = () => {},        // required: (key) => void
  onSelectOne = () => {},   // required: (_id) => void
  onSelectAll = () => {},   // required: () => void
  onAction = () => {},      // required: ({ action, list }) => void
}) {
  const router = useRouter();

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const allSelected = lists.length > 0 && lists.every((l) => selectedIds.includes(l._id));

  return (
    <Table>
      <TableHeader>
        <div className="grid grid-cols-[50px_1fr_120px_140px_120px_120px_140px] items-center">
          <TableCell>
            <Checkbox selected={allSelected} onChange={onSelectAll} />
          </TableCell>

          <TableCell className="cursor-pointer hover:text-primary" onClick={() => onSort("name")}>
            <div className="flex items-center gap-1">
              Name
              {sortConfig.key === "name" &&
                (sortConfig.direction === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
            </div>
          </TableCell>

          <TableCell>Status</TableCell>
          <TableCell>Automation</TableCell>

          <TableCell
            className="cursor-pointer hover:text-primary"
            onClick={() => onSort("stats.totalSubscribers")}
          >
            <div className="flex items-center gap-1">
              Subscribers
              {sortConfig.key === "stats.totalSubscribers" &&
                (sortConfig.direction === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
            </div>
          </TableCell>

          <TableCell
            className="cursor-pointer hover:text-primary"
            onClick={() => onSort("createdAt")}
          >
            <div className="flex items-center gap-1">
              Created
              {sortConfig.key === "createdAt" &&
                (sortConfig.direction === "asc" ? <FiChevronUp /> : <FiChevronDown />)}
            </div>
          </TableCell>

          <TableCell>Actions</TableCell>
        </div>
      </TableHeader>

      <TableBody>
        {lists.map((list) => {
          const isSelected = selectedIds.includes(list._id);
          const isConnected = Boolean(list.automationId);

          return (
            <TableRow key={list._id} isSelected={isSelected}>
              <div className="grid grid-cols-[50px_1fr_120px_140px_120px_120px_140px] items-center">
                <TableCell>
                  <Checkbox selected={isSelected} onChange={() => onSelectOne(list._id)} />
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-20 bg-zinc-100 rounded border overflow-hidden">
                      {list.logo ? (
                        <img src={list.logo} alt={list.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
                          <span className="text-xs text-zinc-400">
                            {list.name?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div
                        className="font-medium text-zinc-800 hover:underline cursor-pointer"
                        onClick={() => router.push(`/my/lists/edit?listId=${list._id}`)}
                      >
                        {list.name}
                      </div>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      list.isActive
                        ? "bg-green-100 text-green-800 border border-green-200"
                        : "bg-red-100 text-red-800 border border-red-200"
                    }`}
                  >
                    {list.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>

                <TableCell>
                  <span
                    className={`flex-nowrap px-2 py-1 rounded text-xs ${
                      isConnected
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-gray-100 text-gray-800 border border-gray-200"
                    }`}
                  >
                    {isConnected ? "Connected" : "Not Connected"}
                  </span>
                </TableCell>

                <TableCell>
                  <span className="font-medium">{list.stats?.totalSubscribers || 0}</span>
                </TableCell>

                <TableCell>
                  <span className="text-sm text-zinc-600">{formatDate(list.createdAt)}</span>
                </TableCell>

                <TableCell>
                  <Dropdown
                    position="left"
                    placeholder="List Actions"
                    options={[
                      {
                        value: "view",
                        label: (
                          <div className="flex items-center gap-2 w-full">
                            <FiEye /> View Details
                          </div>
                        ),
                      },
                      {
                        value: "edit",
                        label: (
                          <div className="flex items-center gap-2 w-full">
                            <FiEdit /> Edit List
                          </div>
                        ),
                      },
                      {
                        value: "copy",
                        label: (
                          <div className="flex items-center gap-2 w-full">
                            <FiCopy /> Copy List Id
                          </div>
                        ),
                      },
                      {
                        value: "delete",
                        label: (
                          <div className="flex items-center gap-2 w-full">
                            <FiTrash2 /> Delete List
                          </div>
                        ),
                      },
                    ]}
                    onChange={(val) => onAction({ action: val, list })}
                  />
                </TableCell>
              </div>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}