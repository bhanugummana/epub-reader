import React, { useRef, useState, useEffect, useCallback } from "react";
import ePub, { Book, Rendition } from "epubjs";
import { addEpub, getEpub, deleteEpub, getAllEpubs } from "./data/indexeddb"; // Import the IndexedDB functions
import InlineView from "epubjs/lib/managers/views/inline";

function getNextHref(currentHref, chapters) {
  const currentIndex = chapters.findIndex(
    (chapter) => chapter.href === currentHref
  );

  if (currentIndex !== -1) {
    if (currentIndex < chapters.length - 1) {
      return chapters[currentIndex + 1].href;
    } else {
      return chapters[currentIndex].href;
    }
  } else {
    return chapters[0].href;
  }
}

function getPrevHref(currentHref, chapters) {
  const currentIndex = chapters.findIndex(
    (chapter) => chapter.href === currentHref
  );

  if (currentIndex > 0) {
    return chapters[currentIndex - 1].href;
  } else {
    return chapters[0].href;
  }
}

const EpubReader: React.FC = () => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [epubKey, setEpubKey] = useState<string>("");
  const [storedEpubs, setStoredEpubs] = useState<{ name: string }[]>([]);

  // UI settings
  const [bgColor, setBgColor] = useState<string>("#121212"); // Default to dark background
  const [fontColor, setFontColor] = useState<string>("#ffffff"); // Default to white font
  const [fontSize, setFontSize] = useState<number>(100); // Percentage
  const [sidePadding, setSidePadding] = useState<number>(0); // Pixels

  // State for settings modal
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // State for TOC modal
  const [showTOC, setShowTOC] = useState<boolean>(false);
  const [toc, setToc] = useState<any[]>([]);

  // Ref to store the current chapter element
  const currentChapterRef = useRef<HTMLButtonElement | null>(null);

  // Load stored settings and last opened EPUB on component mount
  useEffect(() => {
    // Retrieve settings from localStorage
    const storedSettings = localStorage.getItem("epub-reader-settings");
    if (storedSettings) {
      const settings = JSON.parse(storedSettings);
      setBgColor(settings.bgColor || "#121212");
      setFontColor(settings.fontColor || "#ffffff");
      setFontSize(settings.fontSize || 100);
      setSidePadding(settings.sidePadding || 0);
    } else {
      // If no stored settings, set defaults to dark mode
      setBgColor("#121212");
      setFontColor("#ffffff");
    }

    // Load stored EPUBs and the last opened EPUB
    const initialize = async () => {
      const epubs = await loadStoredEpubs(); // Load stored EPUBs

      const lastEpubKey = localStorage.getItem("last-opened-epub");
      if (lastEpubKey) {
        // Check if the EPUB exists in stored EPUBs
        const epubExists = epubs.some((epub) => epub.name === lastEpubKey);
        if (epubExists) {
          await loadEpub(lastEpubKey);
        }
      }
    };

    initialize();
  }, []);

  const loadStoredEpubs = async () => {
    const epubs = await getAllEpubs();
    setStoredEpubs(epubs);
    return epubs; // Return the list of epubs
  };

  const loadEpubFromFile = async (file: File) => {
    // Store the EPUB file in IndexedDB
    await addEpub(file);
    await loadStoredEpubs(); // Refresh the list

    // Load the EPUB
    loadEpub(file.name);
  };

  const loadEpub = async (fileName: string) => {
    const epubData = await getEpub(fileName);
    if (epubData) {
      const _book = ePub(epubData.data);
      setBook(_book);
      setEpubKey(fileName);

      // Save the last opened EPUB to localStorage
      localStorage.setItem("last-opened-epub", fileName);
    }
  };

  useEffect(() => {
    if (book && viewerRef.current) {
      const rendition = book.renderTo(viewerRef.current, {
        width: "100%",
        height: "100%",
        flow: "scrolled",
        view: InlineView,
        manager: "default",
      });
      renditionRef.current = rendition;

      // Retrieve the saved location
      const savedLocation = localStorage.getItem(`epub-location-${epubKey}`);

      changeChapter(savedLocation);

      applyContentStyles();
      applyTheme();
    }
  }, [book, epubKey]);

  // Apply theme whenever UI settings change
  useEffect(() => {
    applyTheme();

    // Store the settings in localStorage
    const settings = {
      bgColor,
      fontColor,
      fontSize,
      sidePadding,
    };
    localStorage.setItem("epub-reader-settings", JSON.stringify(settings));
  }, [bgColor, fontColor, fontSize, sidePadding]);

  const getCurrentChapter = useCallback(() => {
    const savedLocation = localStorage.getItem(`epub-location-${epubKey}`);
    return savedLocation;
  }, [epubKey]);

  const changeChapter = useCallback(
    (chapter: string | null) => {
      if (!renditionRef.current) return;
      if (chapter) {
        renditionRef.current.display(chapter);
        localStorage.setItem(
          `epub-location-${epubKey}`,
          chapter ?? renditionRef.current.book.navigation.toc[0].href
        );
      } else {
        renditionRef.current.display();
      }
    },
    [epubKey]
  );

  const prevChapter = useCallback(() => {
    if (!renditionRef.current) return;
    const prevRef = getPrevHref(
      getCurrentChapter(),
      renditionRef.current.book.navigation.toc
    );
    changeChapter(prevRef);
  }, [getCurrentChapter, changeChapter]);

  const nextChapter = useCallback(() => {
    if (!renditionRef.current) return;
    const nextRef = getNextHref(
      getCurrentChapter(),
      renditionRef.current.book.navigation.toc
    );
    changeChapter(nextRef);
  }, [getCurrentChapter, changeChapter]);

  const applyTheme = () => {
    if (renditionRef.current) {
      // Register or update the theme
      renditionRef.current.themes.register("user-theme", {
        body: {
          background: bgColor,
          color: fontColor,
          paddingLeft: `${sidePadding}px`,
          paddingRight: `${sidePadding}px`,
          fontSize: `${fontSize}%`,
          margin: 0,
        },
        p: {
          lineHeight: "1.6",
        },
      });
      // Apply the theme
      renditionRef.current.themes.select("user-theme");
    }
  };

  const applyContentStyles = () => {
    if (renditionRef.current) {
      (renditionRef.current.themes as any).default({
        body: {
          margin: "0",
          padding: "0",
          overflowX: "hidden",
        },
        img: {
          maxWidth: "100%",
          height: "auto",
          display: "block",
        },
        table: {
          maxWidth: "100%",
          overflowX: "auto",
          display: "block",
        },
        "*": {
          boxSizing: "border-box",
        },
      });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (renditionRef.current && viewerRef.current) {
        const width = viewerRef.current.clientWidth;
        const height = viewerRef.current.clientHeight;
        renditionRef.current.resize(width, height);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleDeleteEpub = async (fileName: string) => {
    await deleteEpub(fileName);
    const epubs = await loadStoredEpubs();
    // If the deleted book is currently open, close it
    if (fileName === epubKey) {
      setBook(null);
      setEpubKey("");
      // Remove last opened EPUB from localStorage
      localStorage.removeItem("last-opened-epub");
    }
    // Check if last-opened-epub still exists
    const lastEpubKey = localStorage.getItem("last-opened-epub");
    if (lastEpubKey && !epubs.some((epub) => epub.name === lastEpubKey)) {
      localStorage.removeItem("last-opened-epub");
    }
  };

  // Recursive function to render TOC items
  const renderTOCItems = (items) => {
    const currentHref = getCurrentChapter();

    return items.map((item) => {
      const isActive = item.href === currentHref;
      const itemRef = isActive ? currentChapterRef : null;

      return (
        <li key={item.href} style={{ marginBottom: "10px" }}>
          <button
            ref={itemRef}
            onClick={() => {
              changeChapter(item.href);
              setShowTOC(false);
            }}
            style={{
              background: "none",
              border: "none",
              color: isActive ? "#FFD700" : "#2196F3", // Highlight current chapter
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              fontSize: "16px",
              fontWeight: isActive ? "bold" : "normal",
            }}
          >
            {item.label}
          </button>
          {item.subitems && item.subitems.length > 0 && (
            <ul style={{ listStyleType: "none", paddingLeft: "20px" }}>
              {renderTOCItems(item.subitems)}
            </ul>
          )}
        </li>
      );
    });
  };

  // Auto-scroll to current chapter when TOC is opened
  useEffect(() => {
    if (showTOC && currentChapterRef.current) {
      currentChapterRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [showTOC]);

  // Close TOC when clicking outside
  const handleTOCOverlayClick = () => {
    setShowTOC(false);
  };

  const handleTOCContentClick = (e) => {
    e.stopPropagation();
  };

  // Add keyboard shortcuts for previous and next chapter
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowLeft") {
        prevChapter();
      } else if (event.key === "ArrowRight") {
        nextChapter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [prevChapter, nextChapter]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        overflow: "hidden",
        backgroundColor: "#121212", // Dark background for the app
        color: "#ffffff", // White text for the app
      }}
    >
      {!book && (
        <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
          <h2>EPUB Reader</h2>
          <input
            type="file"
            accept=".epub"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                loadEpubFromFile(file);
              }
            }}
            style={{ marginBottom: "20px" }}
          />
          <h3>Available EPUBs</h3>
          {storedEpubs.length === 0 && <p>No EPUBs available.</p>}
          <ul style={{ listStyleType: "none", padding: 0 }}>
            {storedEpubs.map((epub) => (
              <li
                key={epub.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "10px",
                  borderBottom: "1px solid #ccc",
                  paddingBottom: "10px",
                }}
              >
                <button
                  onClick={() => loadEpub(epub.name)}
                  style={{
                    flexGrow: 1,
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: "16px",
                    cursor: "pointer",
                    color: "#2196F3", // Light blue color for links
                  }}
                >
                  {epub.name}
                </button>
                <button
                  onClick={() => handleDeleteEpub(epub.name)}
                  style={{
                    padding: "5px 10px",
                    backgroundColor: "#424242",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {book && (
        <div style={{ width: "100%", height: "100%" }}>
          {/* EPUB Viewer */}
          <div
            ref={viewerRef}
            style={{
              width: "100%",
              height: "calc(100% - 60px)", // Adjust for navigation bar height
              overflow: "hidden",
            }}
          ></div>
          {/* Navigation Bar */}
          <div
            style={{
              position: "fixed",
              bottom: 0,
              width: "100%",
              textAlign: "center",
              background: "#1E1E1E", // Dark background for the navigation bar
              padding: "10px 0",
              borderTop: "1px solid #333",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "#ffffff", // White text color
            }}
          >
            <button id="prev" onClick={prevChapter} style={navButtonStyle}>
              Previous Chapter
            </button>
            <button
              onClick={() => {
                if (renditionRef.current) {
                  setToc(renditionRef.current.book.navigation.toc);
                }
                setShowTOC(true);
              }}
              style={navButtonStyle}
            >
              TOC
            </button>
            <button id="next" onClick={nextChapter} style={navButtonStyle}>
              Next Chapter
            </button>
            <button
              onClick={() => setShowSettings(true)}
              style={navButtonStyle}
            >
              Settings
            </button>
            <button
              onClick={() => {
                setBook(null);
                setEpubKey("");
                // Remove last opened EPUB from localStorage
                localStorage.removeItem("last-opened-epub");
              }}
              style={navButtonStyle}
            >
              Close Book
            </button>
          </div>
          {/* TOC Modal */}
          {showTOC && (
            <div
              onClick={handleTOCOverlayClick}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
              }}
            >
              <div
                onClick={handleTOCContentClick}
                style={{
                  background: "#1E1E1E",
                  padding: "20px",
                  borderRadius: "5px",
                  width: "90%",
                  maxWidth: "500px",
                  color: "#ffffff",
                  maxHeight: "80vh",
                  overflowY: "auto",
                }}
              >
                <h2>Table of Contents</h2>
                <ul style={{ listStyleType: "none", padding: 0 }}>
                  {renderTOCItems(toc)}
                </ul>
                <button
                  onClick={() => setShowTOC(false)}
                  style={{
                    marginTop: "10px",
                    padding: "5px 10px",
                    backgroundColor: "#424242",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
          {/* Settings Modal */}
          {showSettings && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  background: "#1E1E1E", // Dark background for the modal
                  padding: "20px",
                  borderRadius: "5px",
                  width: "90%",
                  maxWidth: "500px",
                  color: "#ffffff", // White text color
                }}
              >
                <h2>Settings</h2>
                {/* UI Controls */}
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ width: "120px" }}>Background Color:</span>
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      style={{ marginLeft: "10px" }}
                    />
                  </label>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ width: "120px" }}>Font Color:</span>
                    <input
                      type="color"
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      style={{ marginLeft: "10px" }}
                    />
                  </label>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ width: "120px" }}>Font Size:</span>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      style={{ flexGrow: 1, marginLeft: "10px" }}
                    />
                    <span style={{ marginLeft: "10px" }}>{fontSize}%</span>
                  </label>
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ width: "120px" }}>Side Padding:</span>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={sidePadding}
                      onChange={(e) => setSidePadding(Number(e.target.value))}
                      style={{ flexGrow: 1, marginLeft: "10px" }}
                    />
                    <span style={{ marginLeft: "10px" }}>{sidePadding}px</span>
                  </label>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  style={{
                    marginTop: "10px",
                    padding: "5px 10px",
                    backgroundColor: "#424242",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const navButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  margin: "0 5px",
  fontSize: "16px",
  backgroundColor: "#424242", // Dark button background
  color: "#ffffff", // White text
  border: "none",
  borderRadius: "4px",
};

export default EpubReader;
