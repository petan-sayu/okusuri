import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

// 医師向けレポートPDF生成
export const generateMedicalReportPDF = async (data) => {
  const {
    medications,
    records,
    mentalRecords,
    bleedingRecords,
    appointments,
    patientInfo = {},
  } = data;

  try {
    // PDFドキュメントを作成
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // フォント設定（日本語対応）
    pdf.setFont("helvetica");

    let yPosition = 20;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 6;

    // ヘッダー部分
    pdf.setFontSize(18);
    pdf.text("お薬管理レポート", margin, yPosition);
    yPosition += 10;

    pdf.setFontSize(10);
    pdf.text(
      `生成日時: ${format(new Date(), "yyyy年MM月dd日 HH:mm", { locale: ja })}`,
      margin,
      yPosition
    );
    yPosition += 10;

    // 患者情報セクション
    if (patientInfo.name || patientInfo.age) {
      pdf.setFontSize(14);
      pdf.text("患者情報", margin, yPosition);
      yPosition += lineHeight;

      pdf.setFontSize(10);
      if (patientInfo.name) {
        pdf.text(`氏名: ${patientInfo.name}`, margin + 5, yPosition);
        yPosition += lineHeight;
      }
      if (patientInfo.age) {
        pdf.text(`年齢: ${patientInfo.age}歳`, margin + 5, yPosition);
        yPosition += lineHeight;
      }
      yPosition += 5;
    }

    // 現在の処方薬セクション
    pdf.setFontSize(14);
    pdf.text("現在の処方薬", margin, yPosition);
    yPosition += lineHeight;

    pdf.setFontSize(10);
    medications.forEach((medication, index) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.text(
        `${index + 1}. ${medication.name} ${medication.dosage}`,
        margin + 5,
        yPosition
      );
      yPosition += lineHeight;
      pdf.text(
        `   服薬時間: ${medication.times.join(", ")}`,
        margin + 5,
        yPosition
      );
      yPosition += lineHeight;

      if (medication.notes) {
        pdf.text(`   メモ: ${medication.notes}`, margin + 5, yPosition);
        yPosition += lineHeight;
      }
      yPosition += 2;
    });
    yPosition += 5;

    // 服薬遵守率セクション
    pdf.setFontSize(14);
    pdf.text("服薬遵守率（過去30日）", margin, yPosition);
    yPosition += lineHeight;

    pdf.setFontSize(10);
    medications.forEach((medication) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      const totalExpected = medication.times.length * 30;
      const actualTaken = records.filter(
        (r) => r.medicationId === medication.id
      ).length;
      const adherenceRate =
        totalExpected > 0
          ? ((actualTaken / totalExpected) * 100).toFixed(1)
          : 0;

      pdf.text(
        `${medication.name}: ${adherenceRate}% (${actualTaken}/${totalExpected})`,
        margin + 5,
        yPosition
      );
      yPosition += lineHeight;
    });
    yPosition += 5;

    // メンタル状態セクション
    if (mentalRecords.length > 0) {
      pdf.setFontSize(14);
      pdf.text("メンタル状態（過去30日の平均）", margin, yPosition);
      yPosition += lineHeight;

      pdf.setFontSize(10);
      const avgMood = (
        mentalRecords.reduce((sum, r) => sum + r.mood, 0) / mentalRecords.length
      ).toFixed(1);
      const avgAnxiety = (
        mentalRecords.reduce((sum, r) => sum + r.anxiety, 0) /
        mentalRecords.length
      ).toFixed(1);
      const avgSleep = (
        mentalRecords.reduce((sum, r) => sum + r.sleep, 0) /
        mentalRecords.length
      ).toFixed(1);
      const avgAppetite = (
        mentalRecords.reduce((sum, r) => sum + r.appetite, 0) /
        mentalRecords.length
      ).toFixed(1);
      const avgEnergy = (
        mentalRecords.reduce((sum, r) => sum + r.energy, 0) /
        mentalRecords.length
      ).toFixed(1);

      pdf.text(`気分: ${avgMood}/10`, margin + 5, yPosition);
      yPosition += lineHeight;
      pdf.text(`不安感: ${avgAnxiety}/10`, margin + 5, yPosition);
      yPosition += lineHeight;
      pdf.text(`睡眠の質: ${avgSleep}/10`, margin + 5, yPosition);
      yPosition += lineHeight;
      pdf.text(`食欲: ${avgAppetite}/10`, margin + 5, yPosition);
      yPosition += lineHeight;
      pdf.text(`エネルギー: ${avgEnergy}/10`, margin + 5, yPosition);
      yPosition += lineHeight;
      yPosition += 5;
    }

    // 出血記録セクション（ヤーズフレックス使用者）
    if (medications.some((m) => m.isYazFlex) && bleedingRecords.length > 0) {
      pdf.setFontSize(14);
      pdf.text("出血記録（過去30日）", margin, yPosition);
      yPosition += lineHeight;

      pdf.setFontSize(10);
      const bleedingDays = bleedingRecords.filter(
        (r) => r.level !== "none"
      ).length;
      pdf.text(`出血日数: ${bleedingDays}日`, margin + 5, yPosition);
      yPosition += lineHeight;

      const consecutiveDays = getConsecutiveBleedingDays(bleedingRecords);
      if (consecutiveDays >= 3) {
        pdf.text(
          `※ ${consecutiveDays}日連続の出血を確認`,
          margin + 5,
          yPosition
        );
        yPosition += lineHeight;
      }
      yPosition += 5;
    }

    // 今後の予約セクション
    if (appointments.length > 0) {
      pdf.setFontSize(14);
      pdf.text("今後の予約", margin, yPosition);
      yPosition += lineHeight;

      pdf.setFontSize(10);
      appointments
        .filter((apt) => new Date(apt.date) >= new Date())
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach((appointment) => {
          if (yPosition > pageHeight - 30) {
            pdf.addPage();
            yPosition = 20;
          }

          pdf.text(
            `${format(new Date(appointment.date), "MM月dd日", {
              locale: ja,
            })} ${appointment.time}`,
            margin + 5,
            yPosition
          );
          yPosition += lineHeight;
          pdf.text(
            `${appointment.hospital} - ${appointment.purpose}`,
            margin + 5,
            yPosition
          );
          yPosition += lineHeight;
          yPosition += 2;
        });
    }

    // PDFを保存
    const filename = `medication-report-${format(new Date(), "yyyyMMdd")}.pdf`;
    pdf.save(filename);

    return { success: true, filename };
  } catch (error) {
    console.error("PDF生成エラー:", error);
    return { success: false, error: error.message };
  }
};

// HTMLエレメントからPDF生成
export const generatePDFFromElement = async (elementId, filename) => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with id "${elementId}" not found`);
    }

    // html2canvasでエレメントをキャプチャ
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
    });

    // PDFに変換
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 30;

    pdf.addImage(
      imgData,
      "PNG",
      imgX,
      imgY,
      imgWidth * ratio,
      imgHeight * ratio
    );
    pdf.save(filename);

    return { success: true, filename };
  } catch (error) {
    console.error("PDF生成エラー:", error);
    return { success: false, error: error.message };
  }
};

// CSV生成機能
export const generateMedicationCSV = (records, medications) => {
  const csvData = [
    ["日付", "薬剤名", "用量", "服薬時間", "記録時刻"],
    ...records.map((record) => {
      const medication = medications.find((m) => m.id === record.medicationId);
      return [
        format(new Date(record.timestamp), "yyyy-MM-dd", { locale: ja }),
        medication?.name || "不明",
        medication?.dosage || "",
        record.time,
        format(new Date(record.timestamp), "yyyy-MM-dd HH:mm:ss", {
          locale: ja,
        }),
      ];
    }),
  ];

  const csvContent = csvData
    .map((row) => row.map((field) => `"${field}"`).join(","))
    .join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `medication-records-${format(new Date(), "yyyyMMdd")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, filename: link.download };
};

// 連続出血日数を計算するヘルパー関数
const getConsecutiveBleedingDays = (bleedingRecords) => {
  const sortedRecords = bleedingRecords
    .filter((r) => r.level !== "none")
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let maxConsecutive = 0;
  let currentConsecutive = 0;
  let lastDate = null;

  sortedRecords.forEach((record) => {
    const currentDate = new Date(record.date);

    if (lastDate) {
      const dayDiff = (currentDate - lastDate) / (1000 * 60 * 60 * 24);
      if (dayDiff === 1) {
        currentConsecutive++;
      } else {
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        currentConsecutive = 1;
      }
    } else {
      currentConsecutive = 1;
    }

    lastDate = currentDate;
  });

  return Math.max(maxConsecutive, currentConsecutive);
};
