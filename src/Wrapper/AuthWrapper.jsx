import React from "react";
import useAdminStore from "@/store/useAdminStore";
import useCustomerStore from "@/store/useCustomerStore";

const AuthWrapper = ({ childeren }) => {
  const {
    admin,
    token: adminToken,
    hydrateFromCookies: adminHydrater,
  } = useAdminStore();
  const {
    customer,
    token: customerToken,
    hydrateFromCookies: customerHydrater,
  } = useCustomerStore();
  return childeren;
};

export default AuthWrapper;
