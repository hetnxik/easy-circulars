"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Send, ExternalLink, Bookmark, X,
} from "lucide-react";
import { Viewer, Worker } from "@react-pdf-viewer/core";
import Link from "next/link";
import axios from "axios";
import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import CHAT_QNA_URL from "@/lib/constants";
import pageAuth from "@/components/hoc/pageAuth";

interface Message {
  question: string;
  answer: string;
  sources: string[];
  timestamp: string;
}

interface Conversation {
  conversation_id: string;
  created_at: string;
  last_updated: string;
  history: Message[];
}

interface Circular {
  circular_id: string;
  core_id: string,
  url: string,
  title: string;
  tags: string[];
  date: string;
  bookmark: boolean;
  path: string;
  conversation_id: string;
  pdf_url: string;
}

function CircularPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id as string);
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "keyword-tag";

  const [circular, setCircular] = useState<Circular | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("content");
  const [referencesFetched, setReferencesFetched] = useState(false);
  const [versionsFetched, setVersionsFetched] = useState(false);
  const [references, setReferences] = useState<Circular[]>([]);
  const [versions, setVersions] = useState<Circular[]>([]);
  const [openedReferenceCirculars, setOpenedReferenceCirculars] = useState<Circular[]>([]);
  const [openedVersionCirculars, setOpenedVersionCirculars] = useState<Circular[]>([]);

  const createNewConversation = async (): Promise<string | null> => {
    try {
      const response = await axios.post(`${CHAT_QNA_URL}/api/conversations/new`, {
        db_name: "easy_circulars",
      }, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const { data } = response;
      return data.conversation_id || null;
    } catch (err) {
      setError(`Error creating new conversation: ${err}`);
      return null;
    }
  };

  const updateCircularConversation = async (circularId: string, conversationId: string) => {
    try {
      await axios.patch(
        `${CHAT_QNA_URL}/api/circulars`,
        {
          circular_id: circularId,
          conversation_id: conversationId,
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );
    } catch (err) {
      setError(`Error updating circular: ${err}`);
    }
  };

  const fetchConversation = async (conversationId: string) => {
    try {
      const response = await axios.get(`${CHAT_QNA_URL}/api/conversations/${conversationId}`, {
        params: { db_name: "easy_circulars" },
      });
      setConversation(response.data);
    } catch (err) {
      setError(`Error fetching conversation: ${err}`);
    }
  };

  const fetchCircular = async (circularId: string) => {
    try {
      const response = await axios.get(
        `${CHAT_QNA_URL}/api/circulars`,
        {
          params: { circular_id: circularId },
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );

      const { data } = response;
      setCircular(data.circular);

      let conversationId = data.circular.conversation_id;

      if (!conversationId) {
        conversationId = await createNewConversation();
        if (conversationId) {
          await updateCircularConversation(id, conversationId);
        }
      }

      if (conversationId) {
        await fetchConversation(conversationId);
      }
    } catch (err) {
      setError(`Error fetching circular: ${err}`);
    }
  };

  const fetchReferences = async (circularId: string) => {
    try {
      const response = await axios.get(
        `${CHAT_QNA_URL}/api/circular-references`,
        {
          params: { circular_id: circularId },
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );

      const { data } = response;
      setReferences(data.references);
    } catch (err) {
      setError(`Error fetching references: ${err}`);
    }
  };

  const fetchVersions = async (circularId: string) => {
    try {
      if (!circular?.core_id) {
        setVersions([]);
        return;
      }
      const response = await axios.get(
        `${CHAT_QNA_URL}/api/circular-versions`,
        {
          params: { circular_id: circularId, core_id: circular?.core_id, title: circular?.title },
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );

      const { data } = response;
      setVersions(data.versions);
    } catch (err) {
      setError(`Error fetching versions: ${err}`);
    }
  };

  useEffect(() => {
    if (id) {
      fetchCircular(id);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "references" && !referencesFetched) {
      fetchReferences(id);
      setReferencesFetched(true);
    }
    if (activeTab === "versions" && !versionsFetched) {
      fetchVersions(id);
      setVersionsFetched(true);
    }
  }, [activeTab]);

  const toggleBookmark = async () => {
    if (circular) {
      const updatedCircular = { ...circular, bookmark: !circular.bookmark };

      await axios.patch(
        `${CHAT_QNA_URL}/api/circulars`,
        {
          circular_id: circular.circular_id,
          bookmark: updatedCircular.bookmark,
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        },
      );
      setCircular(updatedCircular);
    }
  };

  const handleSend = async () => {
    if (input.trim() && conversation) {
      setInput("");

      try {
        const response = await axios.post(
          `${CHAT_QNA_URL}/api/conversations/${conversation.conversation_id}`,
          { db_name: "easy_circulars", question: input, circular_id: id },
          { headers: { "Content-Type": "application/json" } },
        );

        const botResponse: Message = {
          question: input,
          answer: response.data.answer,
          sources: response.data.sources || [],
          timestamp: new Date().toISOString(),
        };

        setConversation((prev) => (prev
          ? {
            ...prev,
            history: [...prev.history, botResponse],
            last_updated: new Date().toISOString(),
          }
          : null));
      } catch (err) {
        setError(`Error sending message: ${err}`);
      }
    }
  };

  const handleReferenceClick = (ref: Circular) => {
    setOpenedReferenceCirculars((prev) => {
      const alreadyOpened = prev.some((c) => c.circular_id === ref.circular_id);
      return alreadyOpened ? prev : [...prev, ref];
    });
    setActiveTab(`pdf-${ref.circular_id}`);
  };

  const handleVersionClick = (ver: Circular) => {
    setOpenedVersionCirculars((prev) => {
      const alreadyOpened = prev.some((c) => c.circular_id === ver.circular_id);
      return alreadyOpened ? prev : [...prev, ver];
    });
    setActiveTab(`pdf-${ver.circular_id}`);
  };

  const closeReferencePdfTab = (circularId: string) => {
    setOpenedReferenceCirculars((prev) => {
      const deletedCircularIndex = prev.findIndex((cir) => cir.circular_id === circularId);
      const updatedCirculars = prev.filter((cir) => cir.circular_id !== circularId);

      if (updatedCirculars.length > 0) {
        if (deletedCircularIndex === 0) {
          setActiveTab("references");
        } else {
          const newActiveCircular = updatedCirculars[deletedCircularIndex - 1]
          || updatedCirculars[updatedCirculars.length - 1];
          setActiveTab(`pdf-${newActiveCircular.circular_id}`);
        }
      } else {
        setActiveTab("references");
      }
      return updatedCirculars;
    });
  };

  const closeVersionPdfTab = (circularId: string) => {
    setOpenedVersionCirculars((prev) => {
      const deletedCircularIndex = prev.findIndex((cir) => cir.circular_id === circularId);
      const updatedCirculars = prev.filter((cir) => cir.circular_id !== circularId);

      if (updatedCirculars.length > 0) {
        if (deletedCircularIndex === 0) {
          setActiveTab("versions");
        } else {
          const newActiveCircular = updatedCirculars[deletedCircularIndex - 1]
          || updatedCirculars[updatedCirculars.length - 1];
          setActiveTab(`pdf-${newActiveCircular.circular_id}`);
        }
      } else {
        setActiveTab("versions");
      }
      return updatedCirculars;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Link href={`/search/${from}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button size="sm" onClick={toggleBookmark}>
            <Bookmark className={`h-4 w-4 mr-2 ${circular?.bookmark ? "fill-current" : ""}`} />
            {circular?.bookmark ? "Bookmarked" : "Bookmark"}
          </Button>
        </div>
      </div>
      <h2 className="text-3xl font-bold">{circular?.title}</h2>
      {error && (
        <p className="text-red-500 bg-red-100 border border-red-400 p-2 rounded">
          {error}
        </p>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex justify-start">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
          {openedReferenceCirculars.map((openedCircular) => (
            <TabsTrigger
              key={openedCircular.circular_id}
              value={`pdf-${openedCircular.circular_id}`}
              className="w-[160px] truncate flex items-center justify-between"
              title={openedCircular.title}
            >
              <span className="truncate">{openedCircular.title}</span>
              {activeTab === `pdf-${openedCircular.circular_id}` && (
                <X
                  onClick={(e) => {
                    e.stopPropagation();
                    closeReferencePdfTab(openedCircular.circular_id);
                  }}
                  className="h-4 w-4 ml-2 cursor-pointer shrink-0"
                />
              )}
            </TabsTrigger>
          ))}
          <TabsTrigger value="versions">Versions</TabsTrigger>
          {openedVersionCirculars.map((openedCircular) => (
            <TabsTrigger key={openedCircular.circular_id} value={`pdf-${openedCircular.circular_id}`} className="w-[160px] truncate flex items-center justify-between">
              <span className="truncate">{openedCircular.title}</span>
              {activeTab === `pdf-${openedCircular.circular_id}` && (
                <X
                  onClick={(e) => {
                    e.stopPropagation();
                    closeVersionPdfTab(openedCircular.circular_id);
                  }}
                  className="h-4 w-4 ml-2 cursor-pointer shrink-0"
                />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="content">
          <Card>
            <CardContent className="p-6">
              <ScrollArea className="h-[55vh] mb-4">
                {circular ? (
                  <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.js">
                    <div>
                      <Viewer fileUrl={circular.path} />
                    </div>
                  </Worker>
                ) : (
                  <p>Loading circular content...</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="chat">
          <Card>
            <CardContent className="p-6">
              <ScrollArea className="h-[50vh] mb-4">
                {conversation?.history.map((message, index) => (
                  <>
                    <div key={index} className="mb-4 text-right">
                      <div
                        className="inline-block p-2 rounded-lg bg-primary text-primary-foreground"
                      >
                        {message.question}
                      </div>
                    </div>
                    <div key={index} className="mb-4 text-left">
                      <div
                        className="inline-block p-2 rounded-lg bg-muted"
                      >
                        {message.answer}
                      </div>
                    </div>
                  </>
                ))}
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about this circular..."
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <Button onClick={handleSend}>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="references">
          <Card>
            <CardContent className="p-6">
              <ScrollArea className="h-[50vh]">
                {references.length !== 0 && references.map((ref) => (
                  <div
                    key={ref.circular_id}
                    className="bg-muted text-sm p-2 mb-2 rounded cursor-pointer hover:bg-muted/80"
                    onClick={() => (handleReferenceClick(ref))}
                  >
                    <div className="font-medium flex items-center justify-between">
                      <div className="flex text-blue-600 hover:underline">
                        <span>{ref.title}</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ref.date ? new Date(ref.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }) : "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
                {references.length === 0 && (
                  <p className="text-muted-foreground">No references found for the given circular.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        {openedVersionCirculars.map((openedCircular) => (
          <TabsContent key={`pdf-${openedCircular.circular_id}`} value={`pdf-${openedCircular.circular_id}`}>
            <Card>
              <CardContent className="p-6">
                <ScrollArea className="h-[55vh] mb-4">
                  <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.js">
                    <div>
                      <Viewer fileUrl={openedCircular.path} />
                    </div>
                  </Worker>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
        <TabsContent value="versions">
          <Card>
            <CardContent className="p-6">
              <ScrollArea className="h-[50vh]">
                {versions.length !== 0 && versions.map((ver) => (
                  <div
                    key={ver.circular_id}
                    className="bg-muted text-sm p-2 mb-2 rounded cursor-pointer hover:bg-muted/80"
                    onClick={() => (handleVersionClick(ver))}
                  >
                    <div className="font-medium flex items-center justify-between">
                      <div className="flex text-blue-600 hover:underline">
                        <span>{ver.title}</span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ver.date ? new Date(ver.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }) : "N/A"}
                      </p>
                    </div>
                  </div>
                ))}
                {versions.length === 0 && (
                  <p className="text-muted-foreground">No versions found for the given circular.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        {openedReferenceCirculars.map((openedCircular) => (
          <TabsContent key={`pdf-${openedCircular.circular_id}`} value={`pdf-${openedCircular.circular_id}`}>
            <Card>
              <CardContent className="p-6">
                <ScrollArea className="h-[55vh] mb-4">
                  <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.js">
                    <div>
                      <Viewer fileUrl={openedCircular.path} />
                    </div>
                  </Worker>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default pageAuth(CircularPage);