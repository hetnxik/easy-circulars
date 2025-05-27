"use client";
import pageAuth from "@/components/hoc/pageAuth";


function VisualizePage() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-gray-500 text-lg">Visualization feature coming soon...</p>
    </div>
  );
}

export default pageAuth(VisualizePage);