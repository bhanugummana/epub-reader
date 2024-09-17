import React, { useRef, useState, useEffect } from "react";
import ePub, { Book, Rendition } from "epubjs";

const EpubReader: React.FC = () => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  const loadEpub = (file: File) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const arrayBuffer = e.target?.result;
      if (arrayBuffer) {
        const _book = ePub(arrayBuffer);
        setBook(_book);

        const rendition = _book.renderTo(viewerRef.current!, {
          width: "100%",
          height: "100%",
          flow: "scrolled", // Enable vertical scrolling
          manager: "default", // Load one chapter at a time
        });
        renditionRef.current = rendition;
        rendition.display();

        // Apply styles and dark mode if enabled
        applyContentStyles();
        applyTheme(darkMode);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const nextChapter = () => {
    if (renditionRef.current) {
      renditionRef.current.next().then(() => {
        scrollToTop();
      });
    }
  };

  const prevChapter = () => {
    if (renditionRef.current) {
      renditionRef.current.prev().then(() => {
        scrollToTop();
      });
    }
  };

  const scrollToTop = () => {
    if (renditionRef.current) {
      //   renditionRef.current.getContents().forEach(content => {
      //     content.document.documentElement.scrollTop = 0;
      //   });
    }
  };

  const toggleDarkMode = () => {
    setDarkMode((prevMode) => {
      const newMode = !prevMode;
      applyTheme(newMode);
      return newMode;
    });
  };

  const applyTheme = (dark: boolean) => {
    if (renditionRef.current) {
      (renditionRef.current.themes.override as any)("default", {
        body: {
          background: dark ? "#121212" : "#ffffff",
          color: dark ? "#ffffff" : "#000000",
        },
      });
    }
  };

  const applyContentStyles = () => {
    if (renditionRef.current) {
      (renditionRef.current.themes.override as any)("custom-styles", {
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

  return (
    <div
      style={{ width: "100vw", height: "100vh", margin: 0, overflow: "hidden" }}
    >
      {!book && (
        <div style={{ padding: "10px", fontFamily: "Arial, sans-serif" }}>
          <h2>Load EPUB File</h2>
          <input
            type="file"
            accept=".epub"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                loadEpub(file);
              }
            }}
          />
        </div>
      )}
      {book && (
        <div style={{ width: "100%", height: "100%" }}>
          <div
            ref={viewerRef}
            style={{
              width: "100%",
              height: "calc(100% - 60px)", // Adjust for navigation bar height
              overflow: "hidden", // Prevent horizontal overflow
            }}
          ></div>
          <div
            style={{
              position: "fixed",
              bottom: 0,
              width: "100%",
              textAlign: "center",
              background: darkMode ? "#121212" : "#f0f0f0",
              padding: "10px 0",
            }}
          >
            <button onClick={prevChapter} style={buttonStyle}>
              Previous Chapter
            </button>
            <button onClick={nextChapter} style={buttonStyle}>
              Next Chapter
            </button>
            <label
              style={{ marginLeft: "15px", color: darkMode ? "#fff" : "#000" }}
            >
              <input
                type="checkbox"
                checked={darkMode}
                onChange={toggleDarkMode}
                style={{ marginRight: "5px" }}
              />
              Dark Mode
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 20px",
  marginRight: "10px",
  fontSize: "16px",
};

export default EpubReader;
