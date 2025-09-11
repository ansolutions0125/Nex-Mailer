'use client'
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FiHome } from "react-icons/fi";
import { useRouter } from 'next/navigation';

const NotFound = () => {
  const [countdown, setCountdown] = useState(10);
  const router = useRouter();

  useEffect(() => {
    if (countdown === 0) {
      router.back();
    }
    const timer = setInterval(() => {
      setCountdown(prevCountdown => prevCountdown - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown, router]);

  return (
    <div className="w-full h-screen center-flex">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-lg bg-white p-8 text-center"
      >
        <img src="/icons/404-error.png" alt="" />
        <h2 className="text-4xl font-bold text-gray-800 mb-4">404 Error</h2>
        <p className="text-xl text-gray-600">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <p className="text-xl text-gray-600 mt-4">
          Redirecting in {countdown} seconds...
        </p>
        <button 
          className="mt-6 btn btn-md btn-success gap-3"
          onClick={() => router.push('/')}
        >
          Return to Homepage <FiHome className="inline-block" />
        </button>
      </motion.div>
    </div>
  );
};

export default NotFound 
