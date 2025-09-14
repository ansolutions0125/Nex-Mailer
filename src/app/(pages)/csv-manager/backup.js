"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  FiUpload,
  FiSearch,
  FiRefreshCw,
  FiDownload,
  FiFilter,
  FiChevronDown,
  FiChevronRight,
  FiFile,
  FiDatabase,
  FiPieChart,
  FiBarChart,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiSend,
  FiPlay,
  FiPause,
  FiSettings,
  FiInfo,
  FiHelpCircle,
  FiClock,
  FiUsers,
  FiToggleLeft,
  FiToggleRight,
  FiZap,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import {
  Checkbox,
  inputStyles,
  labelStyles,
  MiniCard,
  ToggleLiver,
} from "@/presets/styles";
import { Dropdown } from "@/components/Dropdown";
import SidebarWrapper from "@/components/SidebarWrapper";

// Tooltip component for helpful notes
const InfoTooltip = ({ content, position = "top" }) => (
  <div className="relative inline-flex group">
    <FiHelpCircle className="w-4 h-4 text-zinc-400 cursor-help" />
    <div
      className={`absolute z-50 invisible group-hover:visible bg-zinc-900 text-white text-xs rounded py-1 px-2 max-w-xs ${
        position === "top"
          ? "bottom-full mb-1 left-1/2 -translate-x-1/2"
          : position === "right"
          ? "left-full ml-1 top-1/2 -translate-y-1/2"
          : "top-full mt-1 left-1/2 -translate-x-1/2"
      }`}
    >
      {content}
      <div
        className={`absolute w-2 h-2 bg-zinc-900 rotate-45 ${
          position === "top"
            ? "top-full left-1/2 -translate-x-1/2 -mt-1"
            : position === "right"
            ? "right-full top-1/2 -translate-y-1/2 -ml-1"
            : "bottom-full left-1/2 -translate-x-1/2 -mb-1"
        }`}
      />
    </div>
  </div>
);

// Data type detection
const detectDataType = (values) => {
  if (!values.length) return "empty";

  const nonEmpty = values.filter((v) => v && String(v).trim());
  if (!nonEmpty.length) return "empty";

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const numberPattern = /^-?\d*\.?\d+$/;
  const phonePattern = /^[\+]?[\d\s\-\(\)]{10,}$/;
  const datePattern =
    /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}|^\d{2}-\d{2}-\d{4}/;

  let emails = 0,
    numbers = 0,
    phones = 0,
    dates = 0;

  nonEmpty.forEach((val) => {
    const str = String(val).trim();
    if (emailPattern.test(str)) emails++;
    else if (numberPattern.test(str)) numbers++;
    else if (phonePattern.test(str)) phones++;
    else if (datePattern.test(str)) dates++;
  });

  const total = nonEmpty.length;
  if (emails / total > 0.8) return "email";
  if (numbers / total > 0.8) return "number";
  if (phones / total > 0.8) return "phone";
  if (dates / total > 0.8) return "date";

  return "text";
};

// Schema detection
const detectSchemas = (data) => {
  const schemas = new Map();

  data.forEach((row, index) => {
    const fields = Object.keys(row).filter(
      (key) => row[key] && String(row[key]).trim()
    );
    const schemaKey = fields.sort().join(",");

    if (!schemas.has(schemaKey)) {
      schemas.set(schemaKey, {
        fields: fields.sort(),
        count: 0,
        rows: [],
        examples: {},
      });
    }

    const schema = schemas.get(schemaKey);
    schema.count++;
    schema.rows.push(index);

    // Store examples for each field
    fields.forEach((field) => {
      if (!schema.examples[field]) schema.examples[field] = [];
      if (schema.examples[field].length < 3) {
        schema.examples[field].push(row[field]);
      }
    });
  });

  return Array.from(schemas.entries()).map(([key, value], index) => ({
    id: index + 1,
    key,
    ...value,
    percentage: ((value.count / data.length) * 100).toFixed(1),
  }));
};

// Field analysis
const analyzeFields = (data) => {
  if (!data.length) return [];

  const allFields = new Set();
  data.forEach((row) => {
    Object.keys(row).forEach((field) => allFields.add(field));
  });

  return Array.from(allFields)
    .map((field) => {
      const values = data
        .map((row) => row[field])
        .filter((v) => v !== undefined);
      const nonEmptyValues = values.filter((v) => v && String(v).trim());
      const uniqueValues = new Set(nonEmptyValues);

      return {
        name: field,
        totalRecords: values.length,
        filledRecords: nonEmptyValues.length,
        emptyRecords: values.length - nonEmptyValues.length,
        completeness: values.length
          ? ((nonEmptyValues.length / values.length) * 100).toFixed(1)
          : 0,
        uniqueValues: uniqueValues.size,
        dataType: detectDataType(nonEmptyValues),
        samples: Array.from(uniqueValues).slice(0, 5),
        avgLength: nonEmptyValues.length
          ? (
              nonEmptyValues.reduce((sum, v) => sum + String(v).length, 0) /
              nonEmptyValues.length
            ).toFixed(1)
          : 0,
      };
    })
    .sort((a, b) => b.filledRecords - a.filledRecords);
};

export default function CSVAnalyzer() {
  // File upload state
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Analysis results
  const [fields, setFields] = useState([]);
  const [schemas, setSchemas] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState("overview"); // overview, fields, schemas, data, api
  const [search, setSearch] = useState("");
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [fieldFilter, setFieldFilter] = useState("all"); // all, complete, incomplete, empty
  const [dataTypeFilter, setDataTypeFilter] = useState("all");
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [expandedSchemas, setExpandedSchemas] = useState(new Set());

  // API Integration state
  const [apiConfig, setApiConfig] = useState({
    url: "",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    batchSize: 20,
    interval: 5000, // 5 seconds
    enabled: false,
    totalSent: 0,
    currentBatch: 0,
  });
  const [selectedApiFields, setSelectedApiFields] = useState(new Set());
  const [apiHeaders, setApiHeaders] = useState([
    { key: "Content-Type", value: "application/json" },
  ]);
  const [isApiRunning, setIsApiRunning] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [sendProgress, setSendProgress] = useState({
    sent: 0,
    total: 0,
    errors: 0,
  });

  const fileInputRef = useRef(null);
  const intervalRef = useRef(null);

  // File processing
  const handleFileUpload = useCallback((uploadedFile) => {
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);
    setError("");

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(
            `CSV parsing errors: ${results.errors
              .map((e) => e.message)
              .join(", ")}`
          );
          setLoading(false);
          return;
        }

        const data = results.data.filter((row) =>
          Object.values(row).some(
            (val) => val !== null && val !== undefined && String(val).trim()
          )
        );

        setCsvData(data);
        setFields(analyzeFields(data));
        setSchemas(detectSchemas(data));
        setLoading(false);
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`);
        setLoading(false);
      },
    });
  }, []);

  // API Integration functions
  const addApiLog = (message, type = "info") => {
    setApiLogs((prev) =>
      [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          message,
          type,
        },
      ].slice(-100)
    ); // Keep last 100 logs
  };

  const sendBatch = async (batch, batchNumber) => {
    try {
      const payload = {
        items: batch.map((item) => {
          const filtered = {};
          selectedApiFields.forEach((field) => {
            if (item[field] !== undefined) {
              filtered[field] = item[field];
            }
          });
          return filtered;
        }),
      };

      const headers = {};
      apiHeaders.forEach((h) => {
        if (h.key.trim() && h.value.trim()) {
          headers[h.key.trim()] = h.value.trim();
        }
      });

      const response = await fetch(apiConfig.url, {
        method: apiConfig.method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json().catch(() => ({ success: true }));

      addApiLog(
        `Batch ${batchNumber}: Successfully sent ${batch.length} records`,
        "success"
      );
      setSendProgress((prev) => ({ ...prev, sent: prev.sent + batch.length }));

      return { success: true, result };
    } catch (error) {
      addApiLog(`Batch ${batchNumber}: Error - ${error.message}`, "error");
      setSendProgress((prev) => ({ ...prev, errors: prev.errors + 1 }));
      return { success: false, error: error.message };
    }
  };

  const startApiIntegration = () => {
    if (!apiConfig.url || selectedApiFields.size === 0) {
      addApiLog("Please configure API URL and select fields", "error");
      return;
    }

    const dataToSend = selectedSchema
      ? csvData.filter((_, index) => selectedSchema.rows.includes(index))
      : csvData;

    if (!dataToSend.length) {
      addApiLog("No data to send", "error");
      return;
    }

    setIsApiRunning(true);
    setSendProgress({ sent: 0, total: dataToSend.length, errors: 0 });
    addApiLog(
      `Starting API integration: ${dataToSend.length} records in batches of ${apiConfig.batchSize}`,
      "info"
    );

    let currentIndex = 0;
    let batchNumber = 1;

    intervalRef.current = setInterval(async () => {
      if (currentIndex >= dataToSend.length) {
        stopApiIntegration();
        addApiLog("All data sent successfully!", "success");
        return;
      }

      const batch = dataToSend.slice(
        currentIndex,
        currentIndex + apiConfig.batchSize
      );
      await sendBatch(batch, batchNumber);

      currentIndex += apiConfig.batchSize;
      batchNumber++;
    }, apiConfig.interval);
  };

  const stopApiIntegration = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsApiRunning(false);
    addApiLog("API integration stopped", "info");
  };

  // Filtered data
  const filteredFields = useMemo(() => {
    let filtered = fields;

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.name.toLowerCase().includes(s) ||
          f.samples.some((sample) => String(sample).toLowerCase().includes(s))
      );
    }

    if (fieldFilter !== "all") {
      filtered = filtered.filter((f) => {
        const completeness = parseFloat(f.completeness);
        switch (fieldFilter) {
          case "complete":
            return completeness === 100;
          case "incomplete":
            return completeness > 0 && completeness < 100;
          case "empty":
            return completeness === 0;
          default:
            return true;
        }
      });
    }

    if (dataTypeFilter !== "all") {
      filtered = filtered.filter((f) => f.dataType === dataTypeFilter);
    }

    return filtered;
  }, [fields, search, fieldFilter, dataTypeFilter]);

  const filteredData = useMemo(() => {
    if (!selectedSchema) return csvData;
    return csvData.filter((_, index) => selectedSchema.rows.includes(index));
  }, [csvData, selectedSchema]);

  // Statistics
  const stats = useMemo(() => {
    if (!csvData.length)
      return {
        totalRows: 0,
        totalFields: 0,
        completeness: 0,
        uniqueSchemas: 0,
      };

    const totalFields = fields.length;
    const totalCells = csvData.length * totalFields;
    const filledCells = fields.reduce((sum, f) => sum + f.filledRecords, 0);
    const completeness = totalCells
      ? ((filledCells / totalCells) * 100).toFixed(1)
      : 0;

    return {
      totalRows: csvData.length,
      totalFields,
      completeness,
      uniqueSchemas: schemas.length,
    };
  }, [csvData, fields, schemas]);

  // Chart data
  const fieldCompletenessData = useMemo(
    () =>
      fields.slice(0, 10).map((f) => ({
        name: f.name.length > 15 ? f.name.substring(0, 15) + "..." : f.name,
        completeness: parseFloat(f.completeness),
        filled: f.filledRecords,
        empty: f.emptyRecords,
      })),
    [fields]
  );

  const dataTypeDistribution = useMemo(() => {
    const types = {};
    fields.forEach((f) => {
      types[f.dataType] = (types[f.dataType] || 0) + 1;
    });
    return Object.entries(types).map(([type, count]) => ({ type, count }));
  }, [fields]);

  const schemaDistribution = useMemo(
    () =>
      schemas.map((s) => ({
        name: `Schema ${s.id} (${s.fields.length} fields)`,
        count: s.count,
        percentage: parseFloat(s.percentage),
      })),
    [schemas]
  );

  const COLORS = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
  ];

  return (
    <SidebarWrapper>
      <div className="bg-white border-b border-zinc-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
              CSV Data Analyzer
              <InfoTooltip
                content="Upload CSV files to analyze data patterns, detect schemas, and send data to APIs with advanced batching controls"
                position="right"
              />
            </h1>
            <p className="text-sm text-zinc-600 mt-1">
              Upload, analyze, and efficiently distribute your CSV data to
              client APIs
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <FiZap className="text-blue-500" />
            <span>Client-side processing • No data uploaded to servers</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* File Upload Section */}
        {!csvData.length ? (
          <div className="bg-white border-2 border-dashed border-zinc-300 rounded-xl p-12 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => handleFileUpload(e.target.files[0])}
              className="hidden"
            />

            {loading ? (
              <div className="flex flex-col items-center">
                <ImSpinner5 className="animate-spin text-4xl text-zinc-400 mb-4" />
                <p className="text-zinc-600">Processing your CSV file...</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Analyzing data patterns and schemas
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="bg-blue-50 rounded-full p-6 mb-4">
                  <FiUpload className="text-3xl text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  Upload your CSV file
                </h3>
                <p className="text-zinc-600 mb-6 max-w-md">
                  Drop your CSV file here or click to browse. We'll analyze the
                  data structure, detect schemas, and provide tools to
                  efficiently send data to your client APIs.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <FiFile />
                  Choose CSV File
                </button>

                <div className="mt-6 text-xs text-zinc-500 max-w-lg">
                  <p className="font-medium mb-1">What happens next:</p>
                  <div className="text-left space-y-1">
                    <p>• Automatic schema detection and field analysis</p>
                    <p>• Data type recognition (email, phone, date, etc.)</p>
                    <p>• Batch processing setup for API integration</p>
                    <p>• Real-time progress monitoring and error handling</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-left max-w-2xl mx-auto">
                <div className="flex items-start gap-2">
                  <FiAlertCircle className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Error processing file</p>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MiniCard
                title="Total Records"
                subLine={stats.totalRows.toLocaleString()}
                icon={<FiDatabase />}
                color="text-blue-600"
                tooltip="Total number of valid data rows found in your CSV file"
              />
              <MiniCard
                title="Total Fields"
                subLine={stats.totalFields}
                icon={<FiBarChart />}
                color="text-emerald-600"
                tooltip="Number of unique columns/fields detected across all records"
              />
              <MiniCard
                title="Data Completeness"
                subLine={`${stats.completeness}%`}
                icon={<FiPieChart />}
                color="text-amber-600"
                tooltip="Percentage of non-empty cells across all fields and records"
              />
              <MiniCard
                title="Unique Schemas"
                subLine={stats.uniqueSchemas}
                icon={<FiFilter />}
                color="text-purple-600"
                tooltip="Different data patterns found - records with similar field combinations"
              />
            </div>

            {/* File Info */}
            <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 rounded-lg p-2">
                  <FiCheck className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">{file?.name}</p>
                  <p className="text-sm text-zinc-600">
                    {file?.size ? `${(file.size / 1024).toFixed(1)} KB` : ""} •
                    Processed {csvData.length} records • Ready for API
                    integration
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCsvData([]);
                  setFields([]);
                  setSchemas([]);
                  setFile(null);
                  setError("");
                  setSelectedSchema(null);
                  stopApiIntegration();
                }}
                className="text-zinc-500 hover:text-zinc-700 p-2"
                title="Clear data and upload new file"
              >
                <FiX />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white border border-zinc-200 rounded-lg mb-6">
              <div className="border-b border-zinc-200 px-6 py-3">
                <div className="flex gap-6">
                  {[
                    {
                      id: "overview",
                      label: "Overview",
                      icon: FiPieChart,
                      desc: "Visual analysis and statistics",
                    },
                    {
                      id: "fields",
                      label: "Field Analysis",
                      icon: FiBarChart,
                      desc: "Detailed field metrics",
                    },
                    {
                      id: "schemas",
                      label: "Schema Detection",
                      icon: FiDatabase,
                      desc: "Data pattern analysis",
                    },
                    {
                      id: "data",
                      label: "Data Preview",
                      icon: FiFile,
                      desc: "Raw data inspection",
                    },
                    {
                      id: "api",
                      label: "API Integration",
                      icon: FiSend,
                      desc: "Send data to external APIs",
                    },
                  ].map(({ id, label, icon: Icon, desc }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors group ${
                        activeTab === id
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                      }`}
                      title={desc}
                    >
                      <Icon className="text-sm" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-semibold">
                        Data Analysis Overview
                      </h2>
                      <InfoTooltip content="Visual representation of your data quality, types, and schema distribution patterns" />
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Field Completeness */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-lg font-semibold text-zinc-900">
                            Field Completeness
                          </h3>
                          <InfoTooltip content="Shows what percentage of records have data for each field. Higher bars indicate more complete fields." />
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={fieldCompletenessData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                              <YAxis domain={[0, 100]} />
                              <Tooltip
                                formatter={(value, name) => [
                                  `${value}%`,
                                  "Completeness",
                                ]}
                                labelFormatter={(label) => `Field: ${label}`}
                              />
                              <Bar dataKey="completeness" fill="#3b82f6" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Data Type Distribution */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <h3 className="text-lg font-semibold text-zinc-900">
                            Data Type Distribution
                          </h3>
                          <InfoTooltip content="Automatically detected data types in your fields. Helps identify emails, phones, numbers, and other structured data." />
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={dataTypeDistribution}
                                dataKey="count"
                                nameKey="type"
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ type, count }) =>
                                  `${type} (${count})`
                                }
                              >
                                {dataTypeDistribution.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Schema Distribution */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-lg font-semibold text-zinc-900">
                          Schema Distribution
                        </h3>
                        <InfoTooltip content="Different data patterns found in your CSV. Each schema represents records with the same field combinations." />
                      </div>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={schemaDistribution}
                            layout="horizontal"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis
                              dataKey="name"
                              type="category"
                              width={150}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(value) => [
                                `${value} records`,
                                "Count",
                              ]}
                            />
                            <Bar dataKey="count" fill="#10b981" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fields Tab */}
                {activeTab === "fields" && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-semibold">Field Analysis</h2>
                      <InfoTooltip content="Detailed analysis of each field including data types, completeness, and sample values" />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                      <div className="flex-1 relative">
                        <FiSearch className="absolute left-3 top-2.5 text-zinc-400" />
                        <input
                          className={`pl-9 ${inputStyles}`}
                          placeholder="Search fields by name or sample values..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <Dropdown
                        options={[
                          { value: "all", label: "All Fields" },
                          { value: "complete", label: "100% Complete" },
                          { value: "incomplete", label: "Partially Complete" },
                          { value: "empty", label: "Empty Fields" },
                        ]}
                        value={fieldFilter}
                        onChange={setFieldFilter}
                        placeholder="Filter by completeness"
                      />
                      <Dropdown
                        options={[
                          { value: "all", label: "All Types" },
                          ...Array.from(
                            new Set(fields.map((f) => f.dataType))
                          ).map((type) => ({
                            value: type,
                            label: type.charAt(0).toUpperCase() + type.slice(1),
                          })),
                        ]}
                        value={dataTypeFilter}
                        onChange={setDataTypeFilter}
                        placeholder="Filter by data type"
                      />
                    </div>

                    {/* Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredFields.map((field) => (
                        <div
                          key={field.name}
                          className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-zinc-900 truncate flex-1 mr-2">
                              {field.name}
                            </h4>
                            <span
                              className={`text-xs px-2 py-1 rounded shrink-0 ${
                                field.dataType === "email"
                                  ? "bg-blue-100 text-blue-800"
                                  : field.dataType === "number"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : field.dataType === "phone"
                                  ? "bg-purple-100 text-purple-800"
                                  : field.dataType === "date"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-zinc-100 text-zinc-800"
                              }`}
                            >
                              {field.dataType}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-zinc-600">
                                Completeness:
                              </span>
                              <span
                                className={`font-medium ${
                                  parseFloat(field.completeness) === 100
                                    ? "text-emerald-600"
                                    : parseFloat(field.completeness) > 50
                                    ? "text-amber-600"
                                    : "text-red-600"
                                }`}
                              >
                                {field.completeness}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-600">Records:</span>
                              <span>
                                {field.filledRecords}/{field.totalRecords}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-600">
                                Unique values:
                              </span>
                              <span>{field.uniqueValues.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-600">Avg length:</span>
                              <span>{field.avgLength} chars</span>
                            </div>
                          </div>

                          {field.samples.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-200">
                              <p className="text-xs text-zinc-600 mb-1 flex items-center gap-1">
                                Sample values
                                <InfoTooltip
                                  content="First few unique values found in this field"
                                  position="right"
                                />
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {field.samples.slice(0, 3).map((sample, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-white px-2 py-1 rounded border truncate max-w-24"
                                  >
                                    {String(sample).substring(0, 15)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Schemas Tab */}
                {activeTab === "schemas" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-semibold">
                        Schema Detection
                      </h2>
                      <InfoTooltip content="Groups of records with similar field patterns. Useful for understanding data structure variations." />
                    </div>

                    <p className="text-zinc-600 mb-6">
                      Found {schemas.length} different data schemas in your CSV.
                      Each schema represents records with the same field
                      combinations.
                    </p>

                    {schemas.map((schema) => (
                      <div
                        key={schema.id}
                        className="border border-zinc-200 rounded-lg overflow-hidden"
                      >
                        <div className="p-4 bg-zinc-50 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                setExpandedSchemas((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(schema.id))
                                    next.delete(schema.id);
                                  else next.add(schema.id);
                                  return next;
                                });
                              }}
                              className="text-zinc-600 hover:text-zinc-900"
                            >
                              {expandedSchemas.has(schema.id) ? (
                                <FiChevronDown />
                              ) : (
                                <FiChevronRight />
                              )}
                            </button>
                            <div>
                              <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                                Schema {schema.id} ({schema.fields.length}{" "}
                                fields)
                                <InfoTooltip
                                  content={`Records containing exactly these fields: ${schema.fields.join(
                                    ", "
                                  )}`}
                                />
                              </h3>
                              <p className="text-sm text-zinc-600">
                                {schema.count} records ({schema.percentage}% of
                                data)
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedSchema(schema);
                                setActiveTab("data");
                              }}
                              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                            >
                              <FiFile className="w-3 h-3" />
                              View Data
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSchema(schema);
                                setSelectedApiFields(new Set(schema.fields));
                                setActiveTab("api");
                              }}
                              className="text-xs px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <FiSend className="w-3 h-3" />
                              Setup API
                            </button>
                          </div>
                        </div>

                        {expandedSchemas.has(schema.id) && (
                          <div className="p-4 border-t border-zinc-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {schema.fields.map((field) => (
                                <div
                                  key={field}
                                  className="bg-white p-3 rounded border"
                                >
                                  <p className="font-medium text-sm text-zinc-900">
                                    {field}
                                  </p>
                                  <p className="text-xs text-zinc-600 mt-1">
                                    Examples:{" "}
                                    {schema.examples[field]
                                      ?.slice(0, 2)
                                      .join(", ") || "—"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Data Tab */}
                {activeTab === "data" && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">Data Preview</h2>
                        <InfoTooltip content="Raw data from your CSV file. Filter by schema to see specific data patterns." />
                      </div>
                      <p className="text-zinc-600">
                        {selectedSchema
                          ? `Showing ${filteredData.length} records from Schema ${selectedSchema.id}`
                          : `Showing all ${csvData.length} records`}
                      </p>
                    </div>

                    {selectedSchema && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FiFilter className="text-blue-600" />
                          <span className="text-sm text-blue-800">
                            Filtered to Schema {selectedSchema.id} with fields:{" "}
                            {selectedSchema.fields.join(", ")}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedSchema(null)}
                          className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100"
                        >
                          Show all data
                        </button>
                      </div>
                    )}

                    <div className="border border-zinc-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-zinc-900 w-16">
                              #
                            </th>
                            {fields.slice(0, 8).map((field) => (
                              <th
                                key={field.name}
                                className="text-left px-3 py-2 font-medium text-zinc-900 min-w-32"
                              >
                                <div className="flex items-center gap-1">
                                  {field.name}
                                  <span
                                    className={`text-xs px-1 py-0.5 rounded ${
                                      field.dataType === "email"
                                        ? "bg-blue-100 text-blue-600"
                                        : field.dataType === "number"
                                        ? "bg-emerald-100 text-emerald-600"
                                        : field.dataType === "phone"
                                        ? "bg-purple-100 text-purple-600"
                                        : "bg-zinc-100 text-zinc-600"
                                    }`}
                                  >
                                    {field.dataType}
                                  </span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {filteredData.slice(0, 100).map((row, index) => (
                            <tr key={index} className="hover:bg-zinc-50">
                              <td className="px-3 py-2 text-zinc-500 text-xs">
                                {index + 1}
                              </td>
                              {fields.slice(0, 8).map((field) => (
                                <td
                                  key={field.name}
                                  className="px-3 py-2 text-zinc-900"
                                >
                                  <div
                                    className="max-w-40 truncate"
                                    title={row[field.name] || ""}
                                  >
                                    {row[field.name] || (
                                      <span className="text-zinc-400">—</span>
                                    )}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {filteredData.length > 100 && (
                      <p className="text-sm text-zinc-600 mt-3 text-center">
                        Showing first 100 rows of {filteredData.length} total
                        records
                      </p>
                    )}
                  </div>
                )}

                {/* API Integration Tab */}
                {activeTab === "api" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-semibold">API Integration</h2>
                      <InfoTooltip content="Configure and send your CSV data to external APIs with batching, rate limiting, and progress monitoring" />
                    </div>

                    {/* Configuration Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* API Configuration */}
                      <div className="bg-white border border-zinc-200 rounded-lg p-4">
                        <h3 className="font-medium text-zinc-900 mb-3 flex items-center gap-2">
                          API Configuration
                          <InfoTooltip content="Set up your client's API endpoint and request parameters" />
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className={labelStyles("required")}>
                              API Endpoint URL
                            </label>
                            <input
                              type="url"
                              value={apiConfig.url}
                              onChange={(e) =>
                                setApiConfig((prev) => ({
                                  ...prev,
                                  url: e.target.value,
                                }))
                              }
                              placeholder="https://api.client.com/users"
                              className={inputStyles}
                            />
                            <p className="text-xs text-zinc-500 mt-1">
                              Your client's API endpoint that will receive the
                              data
                            </p>
                          </div>

                          <div>
                            <label className={labelStyles()}>HTTP Method</label>
                            <select
                              value={apiConfig.method}
                              onChange={(e) =>
                                setApiConfig((prev) => ({
                                  ...prev,
                                  method: e.target.value,
                                }))
                              }
                              className={inputStyles}
                            >
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="PATCH">PATCH</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={labelStyles()}>
                                Batch Size
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={apiConfig.batchSize}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    batchSize: parseInt(e.target.value) || 20,
                                  }))
                                }
                                className={inputStyles}
                              />
                              <p className="text-xs text-zinc-500 mt-1">
                                Records per request
                              </p>
                            </div>

                            <div>
                              <label className={labelStyles()}>
                                Interval (ms)
                              </label>
                              <input
                                type="number"
                                min="100"
                                max="60000"
                                step="100"
                                value={apiConfig.interval}
                                onChange={(e) =>
                                  setApiConfig((prev) => ({
                                    ...prev,
                                    interval: parseInt(e.target.value) || 5000,
                                  }))
                                }
                                className={inputStyles}
                              />
                              <p className="text-xs text-zinc-500 mt-1">
                                Delay between requests
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Headers Configuration */}
                      <div className="bg-white border border-zinc-200 rounded-lg p-4">
                        <h3 className="font-medium text-zinc-900 mb-3 flex items-center gap-2">
                          Request Headers
                          <InfoTooltip content="Configure authentication and other headers for your API requests" />
                        </h3>

                        <div className="space-y-3">
                          {apiHeaders.map((header, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                placeholder="Header name"
                                value={header.key}
                                onChange={(e) => {
                                  const newHeaders = [...apiHeaders];
                                  newHeaders[index].key = e.target.value;
                                  setApiHeaders(newHeaders);
                                }}
                                className={`${inputStyles} flex-1`}
                              />
                              <input
                                placeholder="Header value"
                                value={header.value}
                                onChange={(e) => {
                                  const newHeaders = [...apiHeaders];
                                  newHeaders[index].value = e.target.value;
                                  setApiHeaders(newHeaders);
                                }}
                                className={`${inputStyles} flex-1`}
                              />
                              <button
                                onClick={() =>
                                  setApiHeaders((headers) =>
                                    headers.filter((_, i) => i !== index)
                                  )
                                }
                                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded border border-red-200"
                              >
                                <FiX />
                              </button>
                            </div>
                          ))}

                          <button
                            onClick={() =>
                              setApiHeaders([
                                ...apiHeaders,
                                { key: "", value: "" },
                              ])
                            }
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            + Add Header
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Field Selection */}
                    <div className="bg-white border border-zinc-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-zinc-900 flex items-center gap-2">
                          Select Fields to Send
                          <InfoTooltip content="Choose which fields from your CSV to include in API requests" />
                        </h3>
                        {selectedSchema && (
                          <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            Schema {selectedSchema.id} ({selectedApiFields.size}
                            /{selectedSchema.fields.length} fields selected)
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {(selectedSchema
                          ? selectedSchema.fields
                          : fields.map((f) => f.name)
                        ).map((fieldName) => (
                          <label
                            key={fieldName}
                            className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded cursor-pointer"
                          >
                            <ToggleLiver
                              key={fieldName}
                              checked={selectedApiFields.has(fieldName)}
                              onChange={(checked) => {
                                setSelectedApiFields((prev) => {
                                  const next = new Set(prev);
                                  if (checked) next.add(fieldName);
                                  else next.delete(fieldName);
                                  return next;
                                });
                              }}
                            />{" "}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">
                                {fieldName}
                              </p>
                              <p className="text-xs text-zinc-500">
                                <span className="uppercase">Type:</span> {fields.find((f) => f.name === fieldName)
                                  ?.dataType || "text"}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>

                      {selectedApiFields.size === 0 && (
                        <p className="bg-amber-100 text-amber-600 text-sm px-3 py-2 mt-3 rounded flex items-center gap-1">
                          <FiAlertCircle />
                          Please select at least one field to send
                        </p>
                      )}
                    </div>

                    {/* Control Panel */}
                    <div className="bg-white border border-zinc-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-zinc-900">
                          Control Panel
                        </h3>
                        <div className="flex items-center gap-4">
                          {sendProgress.total > 0 && (
                            <div className="text-sm text-zinc-600">
                              Progress: {sendProgress.sent}/{sendProgress.total}
                              {sendProgress.errors > 0 && (
                                <span className="text-red-600 ml-2">
                                  ({sendProgress.errors} errors)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {!isApiRunning ? (
                          <button
                            onClick={startApiIntegration}
                            disabled={
                              !apiConfig.url || selectedApiFields.size === 0
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-300 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                          >
                            <FiPlay />
                            Start Sending Data
                          </button>
                        ) : (
                          <button
                            onClick={stopApiIntegration}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                          >
                            <FiPause />
                            Stop Integration
                          </button>
                        )}

                        <div className="text-sm text-zinc-600 flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <FiUsers />
                            {selectedSchema
                              ? selectedSchema.count
                              : csvData.length}{" "}
                            records ready
                          </span>
                          <span className="flex items-center gap-1">
                            <FiClock />~
                            {Math.ceil(
                              (((selectedSchema
                                ? selectedSchema.count
                                : csvData.length) /
                                apiConfig.batchSize) *
                                apiConfig.interval) /
                                1000
                            )}
                            s total time
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Logs */}
                    {apiLogs.length > 0 && (
                      <div className="bg-white border border-zinc-200 rounded-lg p-4">
                        <h3 className="font-medium text-zinc-900 mb-3 flex items-center gap-2">
                          Activity Log
                          <InfoTooltip content="Real-time log of API requests, responses, and any errors encountered" />
                        </h3>

                        <div className="bg-zinc-50 rounded border max-h-64 overflow-y-auto">
                          {apiLogs.slice(-50).map((log, index) => (
                            <div
                              key={index}
                              className={`px-3 py-2 text-sm border-b border-zinc-200 last:border-b-0 ${
                                log.type === "error"
                                  ? "bg-red-50 text-red-800"
                                  : log.type === "success"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : "text-zinc-700"
                              }`}
                            >
                              <span className="text-xs text-zinc-500 mr-2">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                              {log.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Performance Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <FiZap />
                        Performance Tips for Faster Data Transfer
                      </h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>
                          • <strong>Optimal Batch Size:</strong> 20-50 records
                          per request for most APIs
                        </li>
                        <li>
                          • <strong>Interval Timing:</strong> 1-5 seconds
                          between requests to avoid rate limits
                        </li>
                        <li>
                          • <strong>Parallel Processing:</strong> Consider
                          splitting large datasets across multiple endpoints
                        </li>
                        <li>
                          • <strong>Field Selection:</strong> Send only required
                          fields to reduce payload size
                        </li>
                        <li>
                          • <strong>Error Handling:</strong> Monitor logs for
                          failed batches and retry mechanisms
                        </li>
                        <li>
                          • <strong>Schema Filtering:</strong> Use schema
                          detection to send consistent data structures
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </SidebarWrapper>
  );
}


