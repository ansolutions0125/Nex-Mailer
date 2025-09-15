"use client";

import { useLayoutEffect, useEffect, useState } from "react";
import PropTypes from "prop-types";
import useAdminStore from "@/store/useAdminStore";
import useCustomerStore from "@/store/useCustomerStore";
import { LoadingSpinner } from "@/presets/styles";

const StoresInitializer = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  // make sure these exist in both stores
  const { hydrateFromCookies: hydrateAdmin, admin } = useAdminStore();
  const { hydrateFromCookies: hydrateCustomer, customer } = useCustomerStore();

  // Run before paint to avoid a flash of empty state
  useLayoutEffect(() => {
    const initializeStores = async () => {
      try {
        await Promise.all([hydrateAdmin?.(), hydrateCustomer?.()]);
      } finally {
        setIsLoading(false);
      }
    };

    initializeStores();
  }, [hydrateAdmin, hydrateCustomer]);

  if (isLoading) {
    return <LoadingSpinner type="page" />;
  }

  return children || null;
};

StoresInitializer.propTypes = { children: PropTypes.node };
export default StoresInitializer;
