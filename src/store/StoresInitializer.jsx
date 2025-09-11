"use client";

import { useLayoutEffect, useEffect } from "react";
import PropTypes from "prop-types";
import useAdminStore from "@/store/useAdminStore";
import useCustomerStore from "@/store/useCustomerStore";

const StoresInitializer = ({ children }) => {
  // make sure these exist in both stores
  const { hydrateFromCookies: hydrateAdmin, admin } = useAdminStore();
  const { hydrateFromCookies: hydrateCustomer, customer } = useCustomerStore();

  // Run before paint to avoid a flash of empty state
  useLayoutEffect(() => {
    hydrateAdmin?.();
    hydrateCustomer?.();
  }, [hydrateAdmin, hydrateCustomer]);

  // optional: log after hydration
  useEffect(() => {
    console.log(admin);
    console.log(customer);
  }, [admin, customer]);

  return children || null;
};

StoresInitializer.propTypes = { children: PropTypes.node };
export default StoresInitializer;
