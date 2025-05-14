"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import axios from "axios";
import Input from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CHAT_QNA_URL from "@/lib/constants";
import { usePageTitle } from "../../contexts/PageTitleContext";

interface Circular {
  circular_id: string;
  title: string;
  tags: string[];
  date: string;
  url: string;
  bookmark: boolean;
  references: string[];
}

export default function KeywordTagSearchPage() {
  const { setPageTitle } = usePageTitle();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setPageTitle("Search Circulars");
    axios
      .get<Circular[]>(`${CHAT_QNA_URL}/api/circulars`, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })
      .then((response) => setCirculars(response.data))
      .catch((err) => setError(`Error fetching circulars: ${err}`));
  }, [setPageTitle]);

  const filteredCirculars = circulars.filter(
    (circular) => (circular.title.toLowerCase().includes(searchTerm.toLowerCase()) || searchTerm === "")
      && (selectedTags.length === 0 || selectedTags.some((tag) => circular.tags.includes(tag))),
  );

  const tagCountMap: Record<string, number> = {};

  circulars.forEach((c) => {
    c.tags.forEach((tag: string) => {
      tagCountMap[tag] = (tagCountMap[tag] || 0) + 1;
    });
  });

  const sortedTags = Object.entries(tagCountMap)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  const handleCircularClick = (id: string) => {
    router.push(`/circulars/${encodeURIComponent(id)}?from=keyword-tag`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-2">
        <div className="relative flex-grow">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search circulars..."
            className="pl-8 bg-background text-foreground"
          />
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Search</Button>
      </div>
      {error && (
        <p className="text-red-500 bg-red-100 border border-red-400 p-2 rounded">
          {error}
        </p>
      )}

      <div className="flex flex-col bg-white border rounded p-2">
        <div className="text-xs text-gray-500 mb-2">
          <span className="mr-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
              <line x1="7" y1="7" x2="7.01" y2="7"></line>
            </svg>
          </span>
          Click on tags to filter content
        </div>
        <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
          {sortedTags.length > 0 ? (
            sortedTags.map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className={`cursor-pointer inline-flex items-center whitespace-nowrap ${
                  selectedTags.includes(tag)
                    ? "bg-emerald-green text-white"
                    : "text-emerald-green"
                }`}
                onClick={() => {
                  setSelectedTags((prev) => {
                    if (prev.includes(tag)) {
                      return prev.filter((t) => t !== tag);
                    }
                    return [...prev, tag];
                  });
                }}
              >
                {tag}
                <span className={`ml-1 text-xs ${selectedTags.includes(tag) ? "text-gray-100" : "text-gray-400"}`}>({tagCountMap[tag]})</span>
              </Badge>
            ))
          ) : (
            <div className="text-gray-400 italic text-sm py-1">No tags available</div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {filteredCirculars.map((circular) => (
          <Card key={circular.circular_id} className="cursor-pointer" onClick={() => handleCircularClick(circular.circular_id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-foreground">{circular.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                Date: {circular.date ? new Date(circular.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }) : "N/A"}
              </p>
              <div className="flex gap-2">
                {circular.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="bg-white text-emerald-green hover:bg-emerald-green hover:text-white"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
