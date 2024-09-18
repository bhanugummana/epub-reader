import JSZip from "jszip";

// Function to convert TXT file to EPUB
export async function convertTxtToEpub(
  file: File,
  minWordCount: number,
  customDelimiter: string
): Promise<Blob> {
  const fileName = file.name.replace(/\.txt$/i, "");
  let textContent = await file.text();

  // Determine chapter delimiters
  let chapterDelimiters;
  if (customDelimiter) {
    chapterDelimiters = new RegExp(`^${escapeRegExp(customDelimiter)}$`, "i");
  } else {
    chapterDelimiters = /^(Chapter|Episode|Part)\s+(\d+|[IVXLC]+)(.*)$/i;
  }

  const chapters = splitIntoChapters(
    textContent,
    minWordCount,
    chapterDelimiters
  );
  if (chapters.length === 0) {
    throw new Error("No chapters detected.");
  }

  // Initialize JSZip
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // META-INF/container.xml
  const containerXML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`;
  zip.folder("META-INF")?.file("container.xml", containerXML);

  // OEBPS/content.opf
  const contentOPF = generateContentOPF(fileName, chapters);
  zip.folder("OEBPS")?.file("content.opf", contentOPF);

  // OEBPS/toc.ncx
  const tocNCX = generateTocNCX(fileName, chapters);
  zip.folder("OEBPS")?.file("toc.ncx", tocNCX);

  // Add individual chapter files
  for (let i = 0; i < chapters.length; i++) {
    const chapterFilename = `chapter${i + 1}.xhtml`;
    const chapterHTML = generateChapterHTML(
      chapters[i].title,
      chapters[i].content
    );
    zip.folder("OEBPS")?.file(chapterFilename, chapterHTML);
  }

  // Styles
  const stylesCSS = `body { font-family: serif; margin: 1em; } p { margin: 1em 0; } h1 { text-align: center; }`;
  zip.folder("OEBPS")?.file("styles.css", stylesCSS);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
  });
  return blob;
}

// Helper functions
function splitIntoChapters(
  text: string,
  minWordCount: number,
  chapterDelimiters: RegExp
) {
  const lines = text.split(/\r?\n/);
  const chapters: any[] = [];
  let currentChapter = { title: "Introduction", content: "" };
  let wordCount = 0;

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (chapterDelimiters.test(trimmedLine) && wordCount >= minWordCount) {
      chapters.push({ ...currentChapter });
      currentChapter = { title: trimmedLine, content: "" };
      wordCount = 0;
    } else {
      currentChapter.content += line + "\n";
      wordCount += countWords(line);
    }
  });

  if (currentChapter.content.trim()) {
    chapters.push({ ...currentChapter });
  }

  return chapters;
}

function countWords(str: string) {
  return str
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function generateContentOPF(
  title: string,
  chapters: { title: string; content: string }[]
) {
  let manifestItems = `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`;
  let spineItems = ``;

  chapters.forEach((_, index) => {
    const chapterId = `chapter${index + 1}`;
    const chapterHref = `chapter${index + 1}.xhtml`;
    manifestItems += `<item id="${chapterId}" href="${chapterHref}" media-type="application/xhtml+xml"/>`;
    spineItems += `<itemref idref="${chapterId}"/>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXML(title)}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">urn:uuid:${generateUUID()}</dc:identifier>
  </metadata>
  <manifest>${manifestItems}</manifest>
  <spine toc="ncx">${spineItems}</spine>
</package>`;
}

function generateTocNCX(
  title: string,
  chapters: { title: string; content: string }[]
) {
  let navPoints = "";
  chapters.forEach((chapter, index) => {
    const playOrder = index + 1;
    const chapterHref = `chapter${index + 1}.xhtml`;
    navPoints += `<navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
      <navLabel><text>${escapeXML(chapter.title)}</text></navLabel>
      <content src="${chapterHref}"/>
    </navPoint>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:${generateUUID()}"/></head>
  <docTitle><text>${escapeXML(title)}</text></docTitle>
  <navMap>${navPoints}</navMap>
</ncx>`;
}

function generateChapterHTML(title: string, content: string) {
  const paragraphs = content
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHTML(line)}</p>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeXML(
    title
  )}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head>
<body><h1>${escapeXML(title)}</h1>${paragraphs}</body>
</html>`;
}

function escapeXML(str: string) {
  return str.replace(
    /[&<>"']/g,
    (match) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[match] || match)
  ); // Use match as fallback
}

function escapeHTML(str: string) {
  return str.replace(
    /[&<>"']/g,
    (match) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[match] || match)
  ); // Use match as fallback
}

function generateUUID() {
  let d = new Date().getTime();
  let d2 = (performance && performance.now && performance.now() * 1000) || 0;
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = Math.random() * 16;
    const v = d > 0 ? (d + r) % 16 : (d2 + r) % 16;
    d = Math.floor(d / 16);
    return (c === "x" ? v : (v & 0x3) | 0x8).toString(16);
  });
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
