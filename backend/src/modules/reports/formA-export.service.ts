import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

export type FormAExportFormat = "csv" | "xlsx" | "pdf";

interface FormAExportRecord {
  LastName: string;
  FirstName: string;
  MiddleName?: string | null;
  Suffix?: string | null;
  PlaceOfBirth?: string | null;
  DateOfBirth?: string | Date | null;
  Age: number;
  Sex: string;
  CivilStatus: string;
  Citizenship: string;
  Occupation?: string | null;
  Household?: string | null;
  Street?: string | null;
  Barangay?: string | null;
  Categories?: string | null;
}

interface FormAExportFile {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

const FORM_A_HEADERS = [
  "Last Name",
  "First Name",
  "Middle Name",
  "Ext",
  "Place of Birth",
  "Date of Birth",
  "Age",
  "Sex",
  "Civil Status",
  "Citizenship",
  "Occupation",
  "Household",
  "Street",
  "Barangay",
  "Categories",
];

const toSafeCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return toSafeCell(value);
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const getTimestampToken = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "_",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
};

export class FormAExportService {
  static async generate(
    format: FormAExportFormat,
    rows: FormAExportRecord[],
  ): Promise<FormAExportFile> {
    const fileName = this.buildFileName(format);

    switch (format) {
      case "csv":
        return {
          buffer: this.generateCsvBuffer(rows),
          contentType: "text/csv; charset=utf-8",
          fileName,
        };
      case "xlsx":
        return {
          buffer: this.generateXlsxBuffer(rows),
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileName,
        };
      case "pdf":
        return {
          buffer: await this.generatePdfBuffer(rows),
          contentType: "application/pdf",
          fileName,
        };
      default:
        throw {
          status: 400,
          message: "Unsupported Form A export format.",
        };
    }
  }

  private static buildFileName(format: FormAExportFormat): string {
    return `form_a_${getTimestampToken()}.${format}`;
  }

  private static toRowValues(row: FormAExportRecord): string[] {
    return [
      toSafeCell(row.LastName),
      toSafeCell(row.FirstName),
      toSafeCell(row.MiddleName),
      toSafeCell(row.Suffix),
      toSafeCell(row.PlaceOfBirth),
      formatDate(row.DateOfBirth),
      toSafeCell(row.Age),
      toSafeCell(row.Sex),
      toSafeCell(row.CivilStatus),
      toSafeCell(row.Citizenship),
      toSafeCell(row.Occupation),
      toSafeCell(row.Household),
      toSafeCell(row.Street),
      toSafeCell(row.Barangay),
      toSafeCell(row.Categories),
    ];
  }

  private static escapeCsv(value: string): string {
    if (/[",\r\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private static generateCsvBuffer(rows: FormAExportRecord[]): Buffer {
    const lines = [
      FORM_A_HEADERS.join(","),
      ...rows.map((row) =>
        this.toRowValues(row)
          .map((value) => this.escapeCsv(value))
          .join(","),
      ),
    ];

    return Buffer.from(lines.join("\n"), "utf-8");
  }

  private static generateXlsxBuffer(rows: FormAExportRecord[]): Buffer {
    const worksheetData = [
      FORM_A_HEADERS,
      ...rows.map((row) => this.toRowValues(row)),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "FormA");

    return Buffer.from(
      XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }),
    );
  }

  private static async generatePdfBuffer(
    rows: FormAExportRecord[],
  ): Promise<Buffer> {
    return await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "LEGAL",
        layout: "landscape",
        margin: 24,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      doc.on("error", reject);
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const columns = [
        { header: "Last Name", width: 72 },
        { header: "First Name", width: 72 },
        { header: "Middle Name", width: 60 },
        { header: "Ext", width: 28 },
        { header: "Place of Birth", width: 90 },
        { header: "Date of Birth", width: 62 },
        { header: "Age", width: 30 },
        { header: "Sex", width: 28 },
        { header: "Civil Status", width: 58 },
        { header: "Citizenship", width: 62 },
        { header: "Occupation", width: 80 },
        { header: "Household", width: 62 },
        { header: "Street", width: 82 },
        { header: "Barangay", width: 56 },
        { header: "Categories", width: 82 },
      ];

      const headerHeight = 20;
      const rowHeight = 18;
      const tableLeft = doc.page.margins.left;
      const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
      const generatedAt = new Date().toLocaleString("en-PH");

      let pageNumber = 1;

      const drawPageHeader = (): number => {
        // 1. Title
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#111827")
          .text("RBI FORM A (Revised 2024)", tableLeft, 24);

        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .text("RECORDS OF BARANGAY INHABITANTS BY HOUSEHOLD", tableLeft, 40, {
            align: "center",
            width: tableWidth,
          });

        // 2. The Missing Key Details (Region, Province, City, Barangay)
        doc.fontSize(10).font("Helvetica-Bold");

        const leftColX = tableLeft;
        const rightColX = tableLeft + tableWidth * 0.80;

        // ROW 1
        doc
          .text("REGION : ", leftColX, 65, { continued: true })
          .font("Helvetica")
          .text("NCR");

        doc
          .font("Helvetica-Bold")
          .text("PROVINCE : ", rightColX, 65, { continued: true })
          .font("Helvetica")
          .text("METRO MANILA");

        // ROW 2
        doc
          .font("Helvetica-Bold")
          .text("CITY/MUNICIPALITY : ", leftColX, 80, { continued: true })
          .font("Helvetica")
          .text("MANILA");

        doc
          .font("Helvetica-Bold")
          .text("BARANGAY : ", rightColX, 80, { continued: true })
          .font("Helvetica")
          .text("BARANGAY 619");

        // 3. Page Number and Timestamp
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#475569")
          .text(`Generated: ${generatedAt}`, tableLeft, 100)
          .text(`Page ${pageNumber}`, tableLeft, 100, {
            width: tableWidth,
            align: "right",
          });

        // 4. Draw the Table Columns below the header
        const tableTop = 115; // Pushed down to make room for our new headers
        let currentX = tableLeft;

        for (let index = 0; index < columns.length; index += 1) {
          const column = columns[index]!;
          doc
            .rect(currentX, tableTop, column.width, headerHeight)
            .fillAndStroke("#e2e8f0", "#94a3b8");
          doc
            .font("Helvetica-Bold")
            .fontSize(7) // Slightly smaller font to fit columns nicely
            .fillColor("#334155")
            .text(column.header, currentX + 2, tableTop + 5, {
              width: column.width - 4,
              align: "center",
            });
          currentX += column.width;
        }

        return tableTop + headerHeight;
      };

      let currentY = drawPageHeader();

      if (rows.length === 0) {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#64748b")
          .text(
            "No active residents found for the selected Form A export.",
            tableLeft,
            currentY + 18,
            {
              width: tableWidth,
              align: "center",
            },
          );
      }

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          pageNumber += 1;
          currentY = drawPageHeader();
        }

        const row = rows[rowIndex]!;
        const values = this.toRowValues(row);

        let currentX = tableLeft;
        for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
          const column = columns[colIndex]!;
          const value = values[colIndex] ?? "";

          doc
            .rect(currentX, currentY, column.width, rowHeight)
            .stroke("#cbd5e1");

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#0f172a")
            .text(value, currentX + 2, currentY + 5, {
              width: column.width - 4,
              height: rowHeight - 6,
              ellipsis: true,
            });

          currentX += column.width;
        }

               currentY += rowHeight;
      }
      
      // If we are too close to the bottom of the page, add a new page first
      if (currentY + 60 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        pageNumber += 1;
        currentY = drawPageHeader();
      }

      currentY += 40; // Add some spacing above the signatures

      const sigWidth = 200;
      const leftSigX = tableLeft;
      const middleSigX = tableLeft + (tableWidth / 2) - (sigWidth / 2);
      const rightSigX = tableLeft + tableWidth - sigWidth;

      // 1. Left Signature (Household)
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827");
      doc.text("All Households", leftSigX, currentY, { width: sigWidth, align: "center" });
      doc.moveTo(leftSigX + 30, currentY + 12).lineTo(leftSigX + sigWidth - 30, currentY + 12).stroke("#000000");
      doc.font("Helvetica").fontSize(8).text("Name of Household", leftSigX, currentY + 16, { width: sigWidth, align: "center" });

      // 2. Middle Signature (Barangay Secretary)
      // (Leaving the bold name empty so the secretary can sign their name on the line)
      doc.font("Helvetica-Bold").fontSize(10).text(" ", middleSigX, currentY, { width: sigWidth, align: "center" });
      doc.moveTo(middleSigX + 30, currentY + 12).lineTo(middleSigX + sigWidth - 30, currentY + 12).stroke("#000000");
      doc.font("Helvetica").fontSize(8).text("Barangay Secretary", middleSigX, currentY + 16, { width: sigWidth, align: "center" });

      // 3. Right Signature (Punong Barangay)
      doc.font("Helvetica-Bold").fontSize(10).text("Hon. Stephen Famoso", rightSigX, currentY, { width: sigWidth, align: "center" });
      doc.moveTo(rightSigX + 30, currentY + 12).lineTo(rightSigX + sigWidth - 30, currentY + 12).stroke("#000000");
      doc.font("Helvetica").fontSize(8).text("Punong Barangay", rightSigX, currentY + 16, { width: sigWidth, align: "center" });


      doc.end();
    });
  }
}
