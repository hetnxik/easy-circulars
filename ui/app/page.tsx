"use client";

import {
  Search, Bookmark, GitCompareArrowsIcon as CompareArrows, BarChartIcon as BubbleChart
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { usePageTitle } from "./contexts/PageTitleContext";

export default function HomePage() {
  const { setPageTitle } = usePageTitle();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(localStorage.getItem("name"));
    const onAuthChange = () => {
      setName(localStorage.getItem("name"));
    };

    window.addEventListener("authChange", onAuthChange);

    return () => {
      window.removeEventListener("authChange", onAuthChange);
    };
  }, []);

  useEffect(() => {
    setPageTitle("Home");
  }, [setPageTitle]);

  const features = [
    {
      title: "Search Circulars",
      icon: Search,
      href: "/search/year-month",
      description:
        "Search RBI circulars by selecting the year and month to easily find circulars issued during a specific time period.",
    },
    {
      title: "Bookmarks",
      icon: Bookmark,
      href: "/bookmarks",
      description:
        "Save important circulars for easy access later. Organize and manage your bookmarked circulars efficiently.",
    },
    {
      title: "Compare Circulars",
      icon: CompareArrows,
      href: "/compare",
      description:
        "Compare different versions of circulars side by side. Easily identify changes and updates in RBI policies.",
    },
    {
      title: "Visualize Relationships",
      icon: BubbleChart,
      href: "/search/keyword-tag",
      description:
        "Explore connections between various RBI circulars. Gain insights through interactive visualizations.",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4 text-header">Welcome to RBI Circular Assistant{ name ? `, ${name}` : '' }</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Use our advanced tools to efficiently navigate and understand RBI circulars.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature) => (
          <Card key={feature.title} className="hover:shadow-lg transition-shadow duration-300 border-secondary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl text-header">
                <feature.icon className="h-8 w-8 text-secondary" />
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-muted-foreground">{feature.description}</p>
              <Link href={feature.href}>
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Explore {feature.title}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
