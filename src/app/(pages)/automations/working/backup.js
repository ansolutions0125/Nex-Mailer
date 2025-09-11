"use client";
import SidebarWrapper from "@/components/SidebarWrapper";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import PropTypes from "prop-types";
import { useRouter } from "next/navigation";
import FlowHeader from "./FlowHeader";
import { isEqual, debounce } from "lodash";
import {
  FiArrowLeft,
  FiPlus,
  FiTrash2,
  FiSend,
  FiClock,
  FiMove,
  FiMail,
  FiX,
  FiZap,
  FiAlertTriangle,
  FiDelete,
} from "react-icons/fi";
import { ImSpinner5 } from "react-icons/im";
import { BsFillLightningFill } from "react-icons/bs";
import { DropdownSearch } from "@/components/DropdownSearch";
import { RiDragMoveFill } from "react-icons/ri";
import { useToastStore } from "@/store/useToastStore";
import ConfirmationModal from "@/components/ConfirmationModal";

// ==================== ACTION TYPES ====================
const ACTIONS = {
  // Data loading
  LOAD_FLOW_START: "LOAD_FLOW_START",
  LOAD_FLOW_SUCCESS: "LOAD_FLOW_SUCCESS",
  LOAD_FLOW_ERROR: "LOAD_FLOW_ERROR",
  LOAD_LISTS_SUCCESS: "LOAD_LISTS_SUCCESS",
  LOAD_TEMPLATES_SUCCESS: "LOAD_TEMPLATES_SUCCESS",
  LOAD_WEBSITES_SUCCESS: "LOAD_WEBSITES_SUCCESS",

  // Field updates
  UPDATE_FIELD: "UPDATE_FIELD",
  VALIDATE_FIELD: "VALIDATE_FIELD",

  // Step operations
  ADD_STEP: "ADD_STEP",
  UPDATE_STEP: "UPDATE_STEP",
  DELETE_STEP: "DELETE_STEP",
  REORDER_STEPS: "REORDER_STEPS",

  // Save operations
  SAVE_START: "SAVE_START",
  SAVE_SUCCESS: "SAVE_SUCCESS",
  SAVE_ERROR: "SAVE_ERROR",

  // UI state
  SET_UI_STATE: "SET_UI_STATE",
  SET_LOADING_STATE: "SET_LOADING_STATE",

  // Change management
  RESET_CHANGES: "RESET_CHANGES",
  MARK_FIELD_CHANGED: "MARK_FIELD_CHANGED",

  // Confirmation modal
  SET_CONFIRMATION: "SET_CONFIRMATION",
};

// ==================== INITIAL STATE ====================
const initialState = {
  // Data layer
  data: {
    original: null,
    current: null,
    lists: [],
    templates: [],
    websites: [],
  },

  // UI state
  ui: {
    editingStep: null,
    activeStepType: null,
    showStats: false,
    editingName: false,
  },

  // Loading states
  loading: {
    flow: true,
    saving: false,
    deleting: false,
    fetching: false,
    templates: false,
  },

  // Validation & errors
  validation: {
    errors: {},
    isValid: true,
    touchedFields: new Set(),
  },

  // Change tracking
  changes: {
    fields: new Set(),
    steps: {
      added: [],
      updated: [],
      deleted: [],
    },
  },

  // Confirmation modal
  confirmation: {
    show: false,
    title: "",
    message: "",
    onConfirm: null,
    onCancel: null,
    isDestructive: false,
    confirmText: "Confirm",
    cancelText: "Cancel",
  },
};

// ==================== VALIDATION UTILS ====================
const validateField = (field, value, currentData) => {
  const errors = [];

  switch (field) {
    case "name":
      if (!value || value.trim() === "") {
        errors.push("Flow name is required");
      } else if (value.length > 100) {
        errors.push("Name must be less than 100 characters");
      }
      break;

    case "steps":
      const stepErrors = {};
      if (Array.isArray(value)) {
        value.forEach((step, index) => {
          const validation = validateStep(step);
          if (!validation.success) {
            stepErrors[index] = validation.errors;
          }
        });
      }
      return {
        isValid: Object.keys(stepErrors).length === 0,
        errors: stepErrors,
      };

    default:
      // Handle nested step field changes
      if (field.startsWith("steps[")) {
        const stepIndex = parseInt(field.match(/steps\[(\d+)\]/)[1]);
        const stepField = field.split(".").pop();
        const stepValidation = validateStepField(stepField, value);

        if (!stepValidation.isValid) {
          return {
            isValid: false,
            errors: { [stepIndex]: { [stepField]: stepValidation.errors } },
          };
        }
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
};

const validateStep = (step) => {
  if (!step || !step.stepType) {
    return { success: false, errors: ["Step type is required"] };
  }

  const errors = [];
  if (!step.title || step.title.trim() === "") {
    errors.push("Step title is required");
  }

  switch (step.stepType) {
    case "sendMail":
      if (!step.sendMailSubject || step.sendMailSubject.trim() === "") {
        errors.push("Email subject is required");
      }
      if (!step.sendMailTemplate || step.sendMailTemplate.trim() === "") {
        errors.push("Email template is required");
      }
      break;
    case "sendWebhook":
      if (!step.webhookUrl || step.webhookUrl.trim() === "") {
        errors.push("Webhook URL is required");
      }
      break;
    case "waitSubscriber":
      if (!step.waitDuration || isNaN(Number(step.waitDuration))) {
        errors.push("Valid wait duration is required");
      }
      break;
    case "moveSubscriber":
    case "removeSubscriber":
      if (!step.targetListId || step.targetListId.trim() === "") {
        errors.push("Target list is required");
      }
      break;
  }

  return {
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
};

const validateStepField = (field, value) => {
  // Add specific step field validation
  return { isValid: true, errors: [] };
};

// ==================== REDUCER ====================
const flowReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.LOAD_FLOW_START:
      return {
        ...state,
        loading: { ...state.loading, flow: true, fetching: true },
        validation: { ...state.validation, errors: {} },
      };

    case ACTIONS.LOAD_FLOW_SUCCESS:
      return {
        ...state,
        data: {
          ...state.data,
          original: action.payload,
          current: { ...action.payload },
        },
        loading: { ...state.loading, flow: false, fetching: false },
        changes: {
          fields: new Set(),
          steps: { added: [], updated: [], deleted: [] },
        },
        validation: { ...state.validation, errors: {}, isValid: true },
      };

    case ACTIONS.LOAD_FLOW_ERROR:
      return {
        ...state,
        loading: { ...state.loading, flow: false, fetching: false },
        validation: {
          ...state.validation,
          errors: { general: action.payload },
          isValid: false,
        },
      };

    case ACTIONS.LOAD_LISTS_SUCCESS:
      return {
        ...state,
        data: { ...state.data, lists: action.payload },
      };

    case ACTIONS.LOAD_WEBSITES_SUCCESS:
      return {
        ...state,
        data: { ...state.data, websites: action.payload },
      };

    case ACTIONS.LOAD_TEMPLATES_SUCCESS:
      return {
        ...state,
        data: { ...state.data, templates: action.payload },
        loading: { ...state.loading, templates: false },
      };

    case ACTIONS.UPDATE_FIELD: {
      const { field, value } = action.payload;
      const newCurrent = { ...state.data.current, [field]: value };

      // Validate the field
      const validation = validateField(field, value, newCurrent);

      // Check if field actually changed
      const hasChanged = !isEqual(state.data.original?.[field], value);
      const newChangedFields = new Set(state.changes.fields);

      if (hasChanged) {
        newChangedFields.add(field);
      } else {
        newChangedFields.delete(field);
      }

      return {
        ...state,
        data: { ...state.data, current: newCurrent },
        changes: { ...state.changes, fields: newChangedFields },
        validation: {
          ...state.validation,
          errors: { ...state.validation.errors, [field]: validation.errors },
          isValid:
            validation.isValid &&
            Object.keys(state.validation.errors).length === 0,
          touchedFields: new Set([...state.validation.touchedFields, field]),
        },
      };
    }

    case ACTIONS.ADD_STEP: {
      const { stepData } = action.payload;
      const currentSteps = state.data.current?.steps || [];
      const nextStepCount =
        currentSteps.length > 0
          ? Math.max(...currentSteps.map((s) => s.stepCount)) + 1
          : 1;

      const newStep = {
        ...stepData,
        _id: stepData._id || `temp_${Date.now()}`,
        stepCount: nextStepCount, // Use calculated next stepCount
      };

      const newSteps = [...currentSteps, newStep];
      const newCurrent = { ...state.data.current, steps: newSteps };

      return {
        ...state,
        data: { ...state.data, current: newCurrent },
        changes: {
          ...state.changes,
          fields: new Set([...state.changes.fields, "steps"]),
          steps: {
            ...state.changes.steps,
            added: [...state.changes.steps.added, newStep._id],
          },
        },
        ui: { ...state.ui, editingStep: null, activeStepType: null },
      };
    }

    case ACTIONS.UPDATE_STEP: {
      const { stepData } = action.payload;
      const newSteps = state.data.current.steps.map((step) =>
        step._id === stepData._id
          ? {
              ...step,
              ...stepData,
              stepCount:
                stepData.stepCount !== undefined
                  ? stepData.stepCount
                  : step.stepCount,
            }
          : step
      );
      const newCurrent = { ...state.data.current, steps: newSteps };

      return {
        ...state,
        data: { ...state.data, current: newCurrent },
        changes: {
          ...state.changes,
          fields: new Set([...state.changes.fields, "steps"]),
          steps: {
            ...state.changes.steps,
            updated: [
              ...new Set([...state.changes.steps.updated, stepData._id]),
            ],
          },
        },
        ui: { ...state.ui, editingStep: null, activeStepType: null },
      };
    }

    case ACTIONS.DELETE_STEP: {
      const { stepId } = action.payload;
      const newSteps = state.data.current.steps
        .filter((step) => step._id !== stepId)
        .map((step, index) => ({
          ...step,
          stepCount: index + 1, // Renumber remaining steps sequentially
        }));

      const newCurrent = { ...state.data.current, steps: newSteps };

      return {
        ...state,
        data: { ...state.data, current: newCurrent },
        changes: {
          ...state.changes,
          fields: new Set([...state.changes.fields, "steps"]),
          steps: {
            added: state.changes.steps.added.filter((id) => id !== stepId),
            updated: state.changes.steps.updated.filter((id) => id !== stepId),
            deleted: [...state.changes.steps.deleted, stepId],
          },
        },
      };
    }

    case ACTIONS.REORDER_STEPS: {
      const { newSteps } = action.payload;

      return {
        ...state,
        data: {
          ...state.data,
          current: {
            ...state.data.current,
            steps: newSteps,
          },
        },
        changes: {
          ...state.changes,
          fields: new Set([...state.changes.fields, "steps"]),
          steps: {
            ...state.changes.steps,
            updated: [
              ...new Set([
                ...state.changes.steps.updated,
                ...newSteps
                  .filter(
                    (step) => !state.changes.steps.added.includes(step._id)
                  )
                  .map((step) => step._id),
              ]),
            ],
          },
        },
      };
    }

    case ACTIONS.SAVE_START:
      return {
        ...state,
        loading: { ...state.loading, saving: true },
      };

    case ACTIONS.SAVE_SUCCESS:
      return {
        ...state,
        data: {
          ...state.data,
          original: action.payload,
          current: { ...action.payload },
        },
        loading: { ...state.loading, saving: false },
        changes: {
          fields: new Set(),
          steps: { added: [], updated: [], deleted: [] },
        },
        validation: { ...state.validation, errors: {}, isValid: true },
      };

    case ACTIONS.SAVE_ERROR:
      return {
        ...state,
        loading: { ...state.loading, saving: false },
        validation: {
          ...state.validation,
          errors: { save: action.payload },
          isValid: false,
        },
      };

    case ACTIONS.RESET_CHANGES:
      return {
        ...state,
        data: { ...state.data, current: { ...state.data.original } },
        changes: {
          fields: new Set(),
          steps: { added: [], updated: [], deleted: [] },
        },
        validation: { ...state.validation, errors: {}, isValid: true },
        ui: { ...state.ui, editingStep: null, activeStepType: null },
      };

    case ACTIONS.SET_UI_STATE:
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };

    case ACTIONS.SET_LOADING_STATE:
      return {
        ...state,
        loading: { ...state.loading, ...action.payload },
      };

    case ACTIONS.SET_CONFIRMATION:
      return {
        ...state,
        confirmation: { ...state.confirmation, ...action.payload },
      };

    default:
      return state;
  }
};

// ==================== CUSTOM HOOKS ====================

// Hook for data fetching
const useFlowData = (flowId) => {
  const fetchFlowData = useCallback(async (id, dispatch) => {
    if (!id) return;

    dispatch({ type: ACTIONS.LOAD_FLOW_START });

    try {
      const res = await axios.get(`/api/work-flow/flow?automationId=${id}`);
      dispatch({
        type: ACTIONS.LOAD_FLOW_SUCCESS,
        payload: res.data.data.automation,
      });

      // Fetch related data
      if (res.data.data.automation.websiteId?._id) {
        const listsRes = await axios.get(
          `/api/list?websiteId=${res.data.data.automation.websiteId?._id}`
        );
        console.log(listsRes.data.data);
        dispatch({
          type: ACTIONS.LOAD_LISTS_SUCCESS,
          payload: listsRes.data.data,
        });
      }

      console.log(res.data.data.automation);
      if (res.data.data.automation.websiteId === null) {
        const websitesRes = await axios.get(`/api/website`);
        console.log(websitesRes);
        dispatch({
          type: ACTIONS.LOAD_WEBSITES_SUCCESS,
          payload: websitesRes.data.data,
        });
      }

      if (res.data.data.automation.websiteId?._id) {
        const templateRes = await axios.get(`/api/templates`);
        console.log(templateRes);
        dispatch({
          type: ACTIONS.LOAD_TEMPLATES_SUCCESS,
          payload: templateRes.data.data,
        });
      }
    } catch (error) {
      console.error("Error fetching flow data:", error);
      dispatch({
        type: ACTIONS.LOAD_FLOW_ERROR,
        payload: error.message || "Failed to load flow",
      });
    }
  }, []);

  return { fetchFlowData };
};

// Hook for save operations
const useFlowSave = () => {
  const saveFlow = useCallback(async (state, dispatch) => {
    dispatch({ type: ACTIONS.SAVE_START });

    try {
      const operations = [];
      const { original, current } = state.data;
      const { steps: stepChanges, fields } = state.changes;

      // Process step operations
      stepChanges.added.forEach((tempId) => {
        const step = current.steps.find((s) => s._id === tempId);
        if (step) {
          const { _id, ...stepData } = step; // Remove temp ID
          operations.push(
            axios.post("/api/work-flow/steps", {
              flowId: original._id,
              step: stepData,
            })
          );
        }
      });

      stepChanges.updated.forEach((stepId) => {
        const step = current.steps.find((s) => s._id === stepId);
        if (step) {
          // Filter out empty fields
          // In the stepChanges.updated.forEach section:
          const filteredStepData = Object.entries(step).reduce(
            (acc, [key, value]) => {
              if (value !== null && value !== undefined && value !== "") {
                acc[key] = value;
              }
              return acc;
            },
            { stepCount: step.stepCount } // Always include stepCount
          );

          operations.push(
            axios.put(`/api/work-flow/steps?stepId=${stepId}`, {
              flowId: original._id,
              stepId: stepId,
              stepData: filteredStepData,
            })
          );
        }
      });

      stepChanges.deleted.forEach((stepId) => {
        operations.push(
          axios.delete(
            `/api/work-flow/steps?flowId=${original._id}&stepId=${stepId}`
          )
        );
      });

      // Process flow-level changes
      const flowChanges = {};
      fields.forEach((field) => {
        if (field !== "steps" && !isEqual(original[field], current[field])) {
          let value = current[field];
          // Handle list ID extraction
          if (field === "listId" && value && value._id) {
            value = value._id;
          }
          flowChanges[field] = value;
        }
      });

      if (Object.keys(flowChanges).length > 0) {
        operations.push(
          axios.put(`/api/work-flow/flow?automationId=${original._id}`, {
            automationId: original._id,
            status: "multi",
            updateData: flowChanges,
          })
        );
      }

      // Execute all operations
      await Promise.all(operations);

      // Refetch updated data
      const res = await axios.get(
        `/api/work-flow/flow?automationId=${original._id}`
      );
      dispatch({
        type: ACTIONS.SAVE_SUCCESS,
        payload: res.data.data.automation,
      });

      return res.data.data.automation;
    } catch (error) {
      console.error("Save failed:", error);
      dispatch({
        type: ACTIONS.SAVE_ERROR,
        payload: error.response?.data?.message || "Failed to save changes",
      });
      throw error;
    }
  }, []);

  return { saveFlow };
};

// Hook for auto-save functionality
const useAutoSave = (state, saveFlow, dispatch) => {
  const debouncedSave = useMemo(
    () =>
      debounce(() => {
        if (state.changes.fields.size > 0) {
          saveFlow(state, dispatch);
        }
      }, 30000), // Auto-save after 30 seconds of inactivity
    [state, saveFlow, dispatch]
  );

  useEffect(() => {
    if (state.changes.fields.size > 0) {
      debouncedSave();
    }
    return () => debouncedSave.cancel();
  }, [state.changes.fields, debouncedSave]);

  return { debouncedSave };
};

// ==================== UTILITY FUNCTIONS ====================
const getDefaultStepTitle = (stepType) => {
  switch (stepType) {
    case "sendWebhook":
      return "Send Webhook";
    case "waitSubscriber":
      return "Wait";
    case "sendMail":
      return "Send Email";
    case "moveSubscriber":
      return "Move Subscriber";
    case "removeSubscriber":
      return "Remove From List";
    case "deleteSubscriber":
      return "Delete Subscriber";
    default:
      return "New Step";
  }
};

// ==================== MAIN COMPONENT ====================
const Page = () => {
  const router = useRouter();
  const [state, dispatch] = useReducer(flowReducer, initialState);
  const addToast = useToastStore((state) => state.addToast);

  // Custom hooks
  const { fetchFlowData } = useFlowData();
  const { saveFlow } = useFlowSave();
  useAutoSave(state, saveFlow, dispatch);

  // Memoized computed values
  const hasUnsavedChanges = useMemo(
    () =>
      state.changes.fields.size > 0 ||
      state.changes.steps.added.length > 0 ||
      state.changes.steps.updated.length > 0 ||
      state.changes.steps.deleted.length > 0,
    [state.changes]
  );

  const sortedSteps = useMemo(
    () =>
      state.data.current?.steps?.sort((a, b) => a.stepCount - b.stepCount) ||
      [],
    [state.data.current?.steps]
  );

  // Action handlers
  const handleFieldChange = useCallback((field, value) => {
    dispatch({
      type: ACTIONS.UPDATE_FIELD,
      payload: { field, value },
    });
  }, []);

  const handleAddStep = useCallback((stepData) => {
    dispatch({
      type: ACTIONS.ADD_STEP,
      payload: {
        stepData: {
          ...stepData,
          _id: `temp_${Date.now()}`,
        },
      },
    });
  }, []);

  const handleUpdateStep = useCallback((stepData) => {
    dispatch({
      type: ACTIONS.UPDATE_STEP,
      payload: { stepData },
    });
  }, []);

  const handleDeleteStep = useCallback((stepId) => {
    dispatch({
      type: ACTIONS.SET_CONFIRMATION,
      payload: {
        show: true,
        title: "Delete Step",
        message: "Are you sure you want to delete this step?",
        onConfirm: () => {
          dispatch({ type: ACTIONS.DELETE_STEP, payload: { stepId } });
          dispatch({
            type: ACTIONS.SET_CONFIRMATION,
            payload: { show: false },
          });
        },
        onCancel: () =>
          dispatch({
            type: ACTIONS.SET_CONFIRMATION,
            payload: { show: false },
          }),
        isDestructive: true,
      },
    });
  }, []);

  const handleSaveFlow = useCallback(async () => {
    try {
      await saveFlow(state, dispatch);
      addToast("Flow saved successfully!", "success");
    } catch (error) {
      addToast(error.message || "Failed to save flow.", "error");
      console.error("Save error handled:", error);
    }
  }, [state, saveFlow]);

  const handleDiscardChanges = useCallback(() => {
    dispatch({
      type: ACTIONS.SET_CONFIRMATION,
      payload: {
        show: true,
        title: "Discard Changes",
        message: "Are you sure you want to discard all unsaved changes?",
        onConfirm: () => {
          dispatch({ type: ACTIONS.RESET_CHANGES });
          dispatch({
            type: ACTIONS.SET_CONFIRMATION,
            payload: { show: false },
          });
          addToast("Discarded changes successfully!", "success");
        },
        onCancel: () =>
          dispatch({
            type: ACTIONS.SET_CONFIRMATION,
            payload: { show: false },
          }),
        isDestructive: true,
      },
    });
  }, []);

  const handleDeleteFlow = useCallback(() => {
    dispatch({
      type: ACTIONS.SET_CONFIRMATION,
      payload: {
        show: true,
        title: "Delete Flow",
        message: "Are you sure you want to delete this automation flow?",
        onConfirm: async () => {
          dispatch({
            type: ACTIONS.SET_LOADING_STATE,
            payload: { deleting: true },
          });
          try {
            await axios.delete(
              `/api/automation?automationId=${state.data.original._id}`
            );
            addToast("Flow deleted successfully!", "success");
            router.push("/automations");
          } catch (error) {
            addToast(error.message || "Failed to delete flow.", "error");
            console.error("Error deleting flow:", error);
          } finally {
            dispatch({
              type: ACTIONS.SET_LOADING_STATE,
              payload: { deleting: false },
            });
            dispatch({
              type: ACTIONS.SET_CONFIRMATION,
              payload: { show: false },
            });
          }
        },
        onCancel: () =>
          dispatch({
            type: ACTIONS.SET_CONFIRMATION,
            payload: { show: false },
          }),
        isDestructive: true,
      },
    });
  }, [state.data.original?._id, router]);

  const handleReorderSteps = useCallback(
    (newOrder) => {
      const stepMap = {};
      state.data.current.steps.forEach((step) => {
        stepMap[step._id] = step;
      });

      const newSteps = newOrder.map((id, index) => ({
        ...stepMap[id],
        stepCount: index + 1, // This ensures sequential numbering
      }));

      dispatch({
        type: ACTIONS.REORDER_STEPS,
        payload: { newSteps },
      });
    },
    [state.data.current?.steps]
  );

  // Initialize data on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("automationId");
    if (id) {
      fetchFlowData(id, dispatch);
    }
  }, [fetchFlowData]);

  // Step options configuration
  const stepOptions = useMemo(
    () => [
      {
        type: "sendMail",
        title: "Send Email",
        icon: <FiMail className="w-4 h-4" />,
        description: "Send an automated email to your subscribers",
        color: "text-blue-500",
      },
      {
        type: "sendWebhook",
        title: "Send Webhook",
        icon: <FiSend className="w-4 h-4" />,
        description: "Trigger external services via webhook",
        color: "text-green-500",
      },
      {
        type: "waitSubscriber",
        title: "Wait / Delay",
        icon: <FiClock className="w-4 h-4" />,
        description: "Add a timed delay between automation steps",
        color: "text-yellow-500",
      },
      {
        type: "moveSubscriber",
        title: "Move Subscriber",
        icon: <FiMove className="w-4 h-4" />,
        description: "Move subscribers between different lists",
        color: "text-purple-500",
      },
      {
        type: "removeSubscriber",
        title: "Remove from List",
        icon: <FiTrash2 className="w-4 h-4" />,
        description: "Remove subscribers from an Spicified List",
        color: "text-red-500",
      },
      {
        type: "deleteSubscriber",
        title: "Delete Subscriber",
        icon: <FiTrash2 className="w-4 h-4" />,
        description: "Remove subscribers from current List",
        color: "text-red-500",
      },
    ],
    []
  );
  // Loading state
  if (state.loading.flow) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Error state
  if (!state.data.original && !state.loading.flow) {
    return (
      <SidebarWrapper>
        <div className="p-6 text-center">
          <p className="text-red-500">Flow not found</p>
          <Link href="/automations" className="btn btn-primary mt-4">
            Back to Automations
          </Link>
        </div>
      </SidebarWrapper>
    );
  }

  return (
    <SidebarWrapper>
      <FlowHeader
        flow={state.data.current}
        saving={state.loading.saving}
        currentList={state.data.current?.listId}
        toggleFlowStatus={(isActive) => handleFieldChange("isActive", isActive)}
        saveFlow={handleSaveFlow}
        hasUnsavedChanges={hasUnsavedChanges}
        website={state.data.current?.websiteId}
        loadingFetching={state.loading.fetching}
        discardAllChanges={handleDiscardChanges}
        editFlowName={(name) => handleFieldChange("name", name)}
        deleteFlow={handleDeleteFlow}
        automationStats={state.data.current?.stats}
        allLists={state.data.lists}
        allWebsites={state.data.websites}
        setCurrentList={(list) => handleFieldChange("listId", list)}
        errors={state.validation.errors}
        handleChange={handleFieldChange}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Workflow Section (Left) */}
        <div className="w-full md:col-span-2 overflow-y-auto">
          <div className="w-full bg-zinc-100 border border-zinc-300 mb-4 p-3 rounded-lg flex flex-col gap-2">
            <div className="between-flex">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white border border-zinc-300 rounded-lg">
                  <BsFillLightningFill className="w-4 h-4" />
                </div>
                <h3 className="text-lg text-zinc-700">Workflow Steps</h3>
              </div>
              <div className="bg-white border border-zinc-300 rounded-lg text-xs p-2">
                <span className="uppercase">Configured</span> :{" "}
                <span className="text-sm">{sortedSteps.length || 0} Steps</span>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg p-3">
              <div className="text-xs font-medium text-zinc-600 bg-zinc-200 border border-zinc-400 px-2 py-1 rounded-full w-fit mb-2">
                Quick Tips:
              </div>
              <ul className="text-xs text-zinc-500 flex flex-col">
                <li className="inline-flex items-center">
                  <div className="w-2 h-2 bg-zinc-200 border border-zinc-400 rounded-full mr-1"></div>
                  Hover over a step to view available actions
                </li>
                <li className="inline-flex items-center">
                  <div className="w-2 h-2 bg-zinc-200 border border-zinc-400 rounded-full mr-1"></div>
                  Click on a step to select and edit its details
                </li>
                <li className="inline-flex items-center">
                  <div className="w-2 h-2 bg-zinc-200 border border-zinc-400 rounded-full mr-1"></div>
                  Drag steps using the handle on the left to reorder
                </li>
              </ul>
            </div>
          </div>

          <div
            className="space-y-4"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
          >
            {!sortedSteps.length ? (
              <div className="text-center py-8 bg-zinc-50 border border-dashed border-zinc-300 rounded-lg">
                <div className="flex justify-center mb-3">
                  <BsFillLightningFill className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-lg font-medium text-zinc-600 mb-2">
                  No Steps Added Yet
                </h3>
                <p className="text-sm text-zinc-500">
                  Start building your workflow by adding steps from the right
                  panel
                </p>
              </div>
            ) : (
              sortedSteps
                .sort((a, b) => a.stepCount - b.stepCount)
                .map((step, index) => (
                  <WorkflowStepCard
                    key={index}
                    step={step}
                    lists={state.data.lists}
                    onSelect={() =>
                      dispatch({
                        type: ACTIONS.SET_UI_STATE,
                        payload: {
                          editingStep: step,
                          activeStepType: step.stepType,
                        },
                      })
                    }
                    onDelete={() => handleDeleteStep(step._id)}
                    isActive={state.ui.editingStep?._id === step._id}
                    templates={state.data.templates}
                    onDragStart={() => {}}
                    onDragEnd={() => {}}
                    onDrop={(draggedId) => {
                      if (draggedId !== step._id) {
                        const newOrder = [...sortedSteps.map((s) => s._id)];
                        const draggedIndex = newOrder.indexOf(draggedId);
                        const targetIndex = newOrder.indexOf(step._id);

                        newOrder.splice(draggedIndex, 1);
                        newOrder.splice(targetIndex, 0, draggedId);

                        handleReorderSteps(newOrder);
                      }
                    }}
                  />
                ))
            )}
          </div>
        </div>

        {/* Step Panel (Right) */}
        <div className="w-full max-w-sm bg-white border border-zinc-300 rounded-lg p-4 overflow-y-auto">
          <StepPanel
            stepType={state.ui.activeStepType}
            editingStep={state.ui.editingStep}
            onSave={(stepData) => {
              if (state.ui.editingStep) {
                handleUpdateStep({
                  ...state.ui.editingStep,
                  ...stepData,
                });
              } else {
                handleAddStep(stepData);
              }
            }}
            onCancel={() =>
              dispatch({
                type: ACTIONS.SET_UI_STATE,
                payload: {
                  editingStep: null,
                  activeStepType: null,
                },
              })
            }
            lists={state.data.lists}
            setActiveStepType={(type) =>
              dispatch({
                type: ACTIONS.SET_UI_STATE,
                payload: { activeStepType: type },
              })
            }
            website={state.data.current?.websiteId}
            currentList={state.data.current?.listId}
            loadings={state.loading}
            stepOptions={stepOptions}
            templates={state.data.templates}
            setIsEditing={(isEditing) =>
              dispatch({
                type: ACTIONS.SET_UI_STATE,
                payload: {
                  editingStep: isEditing ? state.ui.editingStep : null,
                },
              })
            }
          />
        </div>
      </div>

      <ConfirmationModal
        isOpen={state.confirmation.show}
        title={state.confirmation.title}
        message={state.confirmation.message}
        onConfirm={state.confirmation.onConfirm}
        onCancel={state.confirmation.onCancel}
        isDestructive={state.confirmation.isDestructive}
        confirmText={state.confirmation.confirmText}
        cancelText={state.confirmation.cancelText}
      />
    </SidebarWrapper>
  );
};

// ==================== WORKFLOW STEP CARD COMPONENT ====================
const WorkflowStepCard = React.memo(
  ({ step, onSelect, isActive, onDelete, templates, onDrop, lists }) => {
    const [isDraggedOver, setIsDraggedOver] = useState(false);
    const stepIcons = useMemo(
      () => ({
        sendMail: <FiMail className="text-blue-500" />,
        sendWebhook: <FiSend className="text-green-500" />,
        waitSubscriber: <FiClock className="text-yellow-500" />,
        moveSubscriber: <FiMove className="text-purple-500" />,
        removeSubscriber: <FiTrash2 className="text-red-500" />,
        deleteSubscriber: <FiTrash2 className="text-red-500" />,
      }),
      []
    );

    const handleDeleteClick = useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete();
      },
      [onDelete]
    );

    const handleDragStart = useCallback(
      (e) => {
        e.dataTransfer.setData("text/plain", step._id);
        e.currentTarget.classList.add("dragging");
      },
      [step._id]
    );

    const handleDragEnd = useCallback((e) => {
      e.currentTarget.classList.remove("dragging");
    }, []);

    const handleDragOver = useCallback((e) => {
      e.preventDefault();
      setIsDraggedOver(true);
      e.dataTransfer.dropEffect = "move";
    }, []);

    const handleDragLeave = useCallback(() => {
      setIsDraggedOver(false);
    }, []);

    const handleDrop = useCallback(
      (e) => {
        e.preventDefault();
        setIsDraggedOver(false);
        const draggedId = e.dataTransfer.getData("text/plain");
        if (draggedId && onDrop) {
          onDrop(draggedId);
        }
      },
      [onDrop]
    );

    return (
      <div
        className={`w-full relative group rounded-xl transition-all p-5 cursor-pointer overflow-hidden bg-gradient-to-br ${
          isActive
            ? "bg-third/10 border border-l-4 border-third"
            : isDraggedOver
            ? "bg-blue-50 border-blue-200"
            : "from-white to-zinc-50 border hover:border-zinc-300"
        }`}
        onClick={onSelect}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Step indicator ribbon */}
        <div
          className={`absolute left-0 w-2 h-16 z-50 transition-all group rounded-br-lg border-b border-r center-flex ${
            isActive
              ? "bg-third -top-5 "
              : "bg-zinc-300 -top-3 group-hover:-top-0 group-hover:border-zinc-400 group-hover:h-9 group-hover:w-9"
          }`}
        >
          <RiDragMoveFill
            className={`w-4 h-4 
            ${isActive ? "hidden" : "hidden group-hover:flex"}
            cursor-grab hover:scale-[104%] transition-all`}
          />
        </div>
        <div className="flex items-center gap-4">
          {/* Animated step icon */}
          <div
            className={`relative flex-shrink-0 ${
              isActive ? "bg-zinc-200" : ""
            }`}
          >
            <div
              className={`absolute -inset-2 rounded-xl ${
                isActive ? "bg-zinc-200" : "bg-zinc-200/70"
              }`}
            />
            <div
              className={`relative z-10 p-3 rounded-lg backdrop-blur-sm ${
                isActive
                  ? "bg-white/80 shadow-sm border border-white/50"
                  : "bg-white border border-zinc-200"
              }`}
            >
              {stepIcons[step.stepType] || (
                <FiZap
                  className={`w-5 h-5 ${
                    isActive ? "text-purple-600" : "text-zinc-500"
                  }`}
                />
              )}
            </div>
          </div>

          <div className="w-full flex flex-col md:flex-row items-start justify-between gap-2">
            {/* Content area */}
            <div className="w-full flex-1 min-w-0 space-y-1.5">
              <div className="w-full flex flex-col items-start gap-2">
                <h3
                  className={`text-sm font-medium ${
                    isActive ? "text-zinc-800" : "text-zinc-700"
                  }`}
                >
                  {step.title || step.description || step.stepType}
                </h3>

                {step.stepType === "waitSubscriber" && step.waitDuration && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-100 border text-zinc-600">
                    <FiClock size={12} />
                    <span>
                      {step.waitDuration} {step.waitUnit}
                    </span>
                  </span>
                )}
                {step.stepType === "sendWebhook" && step.webhookUrl && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-100 border text-zinc-600">
                    <FiSend size={12} />
                    <span>Send Webhook Request to: {step.webhookUrl}</span>
                  </span>
                )}
                {step.stepType === "sendMail" && step.sendMailTemplate && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-100 border text-zinc-600">
                    <FiSend size={12} />
                    <span>
                      Sending{" | "}
                      {templates?.find(
                        (temp) => temp._id === step.sendMailTemplate
                      )?.name || "Untitled Template"}
                      {" | "} Template
                    </span>
                  </span>
                )}
                {step.stepType === "deleteSubscriber" && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-100 border text-zinc-600">
                    <FiDelete size={12} />
                    <span>Delete Subscriber from current List</span>
                  </span>
                )}

                {step.stepType === "moveSubscriber" && step.targetListId && (
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-100 border text-zinc-600">
                    <FiClock size={12} />
                    <span>
                      Move Subscriber To:{" "}
                      {lists.find((l) => l._id === step.targetListId)?.name}
                    </span>{" "}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons - appears on hover */}
            <div
              className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                isActive ? "!opacity-100" : ""
              }`}
            >
              <button
                onClick={handleDeleteClick}
                className="btn btn-sm btn-delete"
                title="Delete step"
                type="button"
              >
                <FiTrash2 />
              </button>
              <div className="text-xs font-medium p-2 py-1.5 rounded bg-white border border-zinc-400 text-zinc-600">
                #{step.stepCount}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

WorkflowStepCard.displayName = "WorkflowStepCard";

// ==================== STEP PANEL COMPONENT ====================
const StepPanel = React.memo(
  ({
    stepType,
    editingStep,
    onSave,
    onCancel,
    lists = [],
    currentList,
    templates = [],
    stepOptions = [],
    loadings = {},
    setActiveStepType,
    setIsEditing,
  }) => {
    console.log(lists);
    const [formData, setFormData] = useState({
      stepType: "sendMail",
      title: "",
      description: "",
      webhookUrl: "",
      requestMethod: "POST",
      requestHeaders: [],
      requestBody: "",
      retryAttempts: 3,
      retryAfterSeconds: 5,
      waitDuration: "2",
      waitUnit: "weeks",
      targetListId: "",
      sendMailTemplate: "",
      sendMailSubject: "",
      stepCount: null,
    });

    // Update form data when editing step changes
    useEffect(() => {
      if (editingStep) {
        setFormData(editingStep);
      } else if (stepType) {
        setFormData((prev) => ({
          ...prev,
          stepType,
          title: getDefaultStepTitle(stepType),
          // Clear targetListId when switching to deleteSubscriber
          ...(stepType === "deleteSubscriber" && { targetListId: "" }),
          stepCount: null, // Reset stepCount when creating a new step
        }));
      }
    }, [stepType, editingStep]);

    const handleChange = useCallback((e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    }, []);

    const handleHeaderChange = useCallback((index, field, value) => {
      setFormData((prev) => {
        const updatedHeaders = [...prev.requestHeaders];
        updatedHeaders[index] = { ...updatedHeaders[index], [field]: value };
        return { ...prev, requestHeaders: updatedHeaders };
      });
    }, []);

    const addHeader = useCallback(() => {
      setFormData((prev) => ({
        ...prev,
        requestHeaders: [...prev.requestHeaders, { key: "", value: "" }],
      }));
    }, []);

    const removeHeader = useCallback((index) => {
      setFormData((prev) => ({
        ...prev,
        requestHeaders: prev.requestHeaders.filter((_, i) => i !== index),
      }));
    }, []);

    const handleSave = useCallback(() => {
      // Remove stepCount from the data we send to parent
      const { stepCount, ...stepData } = formData;
      onSave(stepData);
    }, [formData, onSave]);

    const inputStyles =
      "w-full bg-zinc-50 text-sm rounded border border-b-2 border-zinc-300 focus:border-primary px-4 py-2 text-zinc-800 outline-none placeholder-zinc-500";

    const labelStyles = (type) => {
      const baseStyles = "font-semibold text-zinc-500 uppercase tracking-wider";
      return type === "mini"
        ? `text-[0.6rem] ${baseStyles}`
        : `text-xs ${baseStyles}`;
    };

    const renderFormContent = useCallback(() => {
      switch (formData.stepType) {
        case "sendWebhook":
          return (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="webhookUrl" className={labelStyles("base")}>
                  Webhook URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    id="webhookUrl"
                    name="webhookUrl"
                    value={formData.webhookUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/webhook"
                    className={inputStyles}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="requestMethod" className={labelStyles("base")}>
                  HTTP Method
                </label>
                <select
                  id="requestMethod"
                  name="requestMethod"
                  value={formData.requestMethod}
                  onChange={handleChange}
                  className={inputStyles}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelStyles("base")}>Request Headers</label>
                <div className="space-y-2">
                  {formData.requestHeaders?.map((header, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Header name"
                        value={header.key}
                        onChange={(e) =>
                          handleHeaderChange(index, "key", e.target.value)
                        }
                        className={`${inputStyles} flex-1`}
                      />
                      <input
                        type="text"
                        placeholder="Header value"
                        value={header.value}
                        onChange={(e) =>
                          handleHeaderChange(index, "value", e.target.value)
                        }
                        className={`${inputStyles} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => removeHeader(index)}
                        className="btn btn-sm bg-zinc-200 hover:bg-red-600 hover:text-white transition-all duration-200 rounded"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addHeader}
                    className="btn btn-xs btn-primary center-flex gap-1"
                  >
                    <FiPlus size={14} /> Add Header
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="requestBody" className={labelStyles("base")}>
                  Request Body (JSON)
                </label>
                <textarea
                  id="requestBody"
                  name="requestBody"
                  value={formData.requestBody}
                  onChange={handleChange}
                  placeholder="Enter JSON payload"
                  className={`${inputStyles} h-32`}
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="retryAttempts"
                    className={labelStyles("base")}
                  >
                    Retry Attempts
                  </label>
                  <input
                    type="number"
                    id="retryAttempts"
                    name="retryAttempts"
                    min="0"
                    max="10"
                    value={formData.retryAttempts}
                    onChange={handleChange}
                    className={inputStyles}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="retryAfterSeconds"
                    className={labelStyles("base")}
                  >
                    Retry Interval (seconds)
                  </label>
                  <input
                    type="number"
                    id="retryAfterSeconds"
                    name="retryAfterSeconds"
                    min="1"
                    max="60"
                    value={formData.retryAfterSeconds}
                    onChange={handleChange}
                    className={inputStyles}
                  />
                </div>
              </div>
            </div>
          );

        case "waitSubscriber":
          return (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="waitDuration" className={labelStyles("base")}>
                  Wait Duration
                </label>
                <input
                  type="number"
                  id="waitDuration"
                  name="waitDuration"
                  value={formData.waitDuration}
                  onChange={handleChange}
                  placeholder="e.g., 2"
                  className={inputStyles}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="waitUnit" className={labelStyles("base")}>
                  Wait Unit
                </label>
                <select
                  id="waitUnit"
                  name="waitUnit"
                  value={formData.waitUnit}
                  onChange={handleChange}
                  className={inputStyles}
                >
                  <option value="seconds">Seconds</option>
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>{" "}
              </div>
            </div>
          );

        case "sendMail":
          return (
            <div className="space-y-4">
              {loadings.templates ? (
                <div className="flex justify-center py-4">
                  <ImSpinner5 className="animate-spin text-gray-500" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="sendMailTemplate"
                      className={labelStyles("base")}
                    >
                      Email Template
                    </label>
                    <DropdownSearch
                      id="sendMailTemplate"
                      name="sendMailTemplate"
                      options={
                        templates?.map((template) => ({
                          value: template._id,
                          label: template.name,
                        })) || []
                      }
                      value={formData.sendMailTemplate}
                      onChange={(selectedValue) => {
                        handleChange({
                          target: {
                            name: "sendMailTemplate",
                            value: selectedValue,
                          },
                        });
                      }}
                      placeholder="Select a template"
                      searchPlaceholder="Search templates..."
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="sendMailSubject"
                      className={labelStyles("base")}
                    >
                      Email Subject
                    </label>
                    <input
                      type="text"
                      id="sendMailSubject"
                      name="sendMailSubject"
                      value={formData.sendMailSubject}
                      onChange={handleChange}
                      placeholder="Enter email subject"
                      className={inputStyles}
                    />
                  </div>
                </>
              )}
            </div>
          );

        case "moveSubscriber":
          return (
            <div className="flex flex-col gap-2">
              <label htmlFor="targetListId" className={labelStyles("base")}>
                Move to List
              </label>
              <select
                id="targetListId"
                name="targetListId"
                value={formData.targetListId}
                onChange={handleChange}
                className={inputStyles}
              >
                <option value="">Select a list</option>
                {lists
                  .filter((list) => list._id !== currentList?._id)
                  .map((list) => (
                    <option key={list._id} value={list._id}>
                      {list.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-zinc-500 mt-1">
                Subscribers will be moved to the selected list
              </p>
            </div>
          );

        case "removeSubscriber":
          return (
            <div className="flex flex-col gap-2">
              <label htmlFor="targetListId" className={labelStyles("base")}>
                Remove From List
              </label>
              <select
                id="targetListId"
                name="targetListId"
                value={formData.targetListId}
                onChange={handleChange}
                className={inputStyles}
              >
                <option value="">Select a list</option>
                {lists.map((list) => (
                  <option key={list._id} value={list._id}>
                    {list.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 mt-1">
                Subscribers will be removed from the selected list
              </p>
            </div>
          );

        case "deleteSubscriber":
          return (
            <div className="flex flex-col gap-2">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-yellow-800 text-sm font-medium">
                  <FiAlertTriangle className="inline mr-2" />
                  This will permanently delete subscribers from the current list
                </p>
                <p className="text-yellow-700 text-xs mt-1">
                  Current list:{" "}
                  <strong>{currentList?.name || "Not selected"}</strong>
                </p>
              </div>
              <input type="hidden" name="targetListId" value="" />
            </div>
          );

        default:
          return null;
      }
    }, [
      formData,
      handleChange,
      handleHeaderChange,
      addHeader,
      removeHeader,
      inputStyles,
      labelStyles,
      loadings.templates,
      templates,
      lists,
    ]);

    if (!stepType) {
      return (
        <div className="w-full text-center">
          <h3 className="text-lg font-semibold tracking-wide mb-1">
            Select a Step Type
          </h3>
          <p className="text-zinc-500 mb-6 text-sm">
            Choose a step type from this panel
          </p>
          <div className="grid grid-cols-1 gap-2">
            {stepOptions?.map((option) => (
              <button
                key={option.type}
                onClick={() => {
                  setActiveStepType(option.type);
                  setIsEditing(false);
                }}
                className="flex items-center gap-2 border border-zinc-200 hover:bg-zinc-100 px-3 py-2 rounded-md transition-all"
              >
                <div className="bg-zinc-100 border border-zinc-200 p-2 rounded-lg text-primary">
                  {option.icon}
                </div>
                <div className="flex flex-col items-start text-start">
                  <h4 className="text-sm text-zinc-600 font-semibold">
                    {option.title}
                  </h4>
                  <p className="text-xs text-zinc-500">{option.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">
            {editingStep ? "Edit Step" : "Add New Step"}
          </h3>
          <button onClick={onCancel} className="btn btn-sm btn-second">
            <FiX />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key="step-form"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6 flex-grow"
          >
            <motion.div
              className="flex flex-col gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <label htmlFor="title" className={labelStyles("base")}>
                Step Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Send Welcome Email"
                className={inputStyles}
              />
            </motion.div>

            <motion.div
              className="flex flex-col gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <label htmlFor="description" className={labelStyles("base")}>
                Description (optional)
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add a short description"
                className={inputStyles}
              />
            </motion.div>

            <motion.div
              className="flex-grow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {renderFormContent()}
            </motion.div>

            <motion.div
              className="flex justify-between pt-4 border-t border-gray-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
            >
              {!editingStep && (
                <button onClick={onCancel} className="btn btn-sm btn-second">
                  <FiArrowLeft /> Back
                </button>
              )}
              <div
                className={`flex gap-2 ${
                  editingStep ? "w-full justify-end" : ""
                }`}
              >
                <button
                  onClick={handleSave}
                  className="btn btn-sm btn-primary center-flex"
                >
                  {editingStep ? "Update Step" : "Add Step"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }
);

StepPanel.displayName = "StepPanel";

// ==================== PROP TYPES ====================
Page.propTypes = {
  router: PropTypes.shape({
    query: PropTypes.object.isRequired,
    push: PropTypes.func.isRequired,
  }),
};

WorkflowStepCard.propTypes = {
  step: PropTypes.object.isRequired,
  onSelect: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
  onDelete: PropTypes.func.isRequired,
};

StepPanel.propTypes = {
  stepType: PropTypes.string,
  editingStep: PropTypes.oneOfType([PropTypes.object, PropTypes.bool]),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  lists: PropTypes.array,
  website: PropTypes.object,
  currentList: PropTypes.object,
  templates: PropTypes.array,
  stepOptions: PropTypes.array,
  loadings: PropTypes.object,
  setActiveStepType: PropTypes.func.isRequired,
  setIsEditing: PropTypes.func.isRequired,
};

export default Page;
