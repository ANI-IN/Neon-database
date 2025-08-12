document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("query-form");
  const input = document.getElementById("query-input");
  const submitBtn = document.getElementById("submit-btn");

  // Result containers
  const loader = document.getElementById("loader-container");
  const errorContainer = document.getElementById("error-container");
  const errorMessage = document.getElementById("error-message");
  const summarySection = document.getElementById("summary-section");
  const summaryText = document.getElementById("summary-text");
  const tableSection = document.getElementById("table-section");
  const resultsTable = document.getElementById("results-table");
  const sqlSection = document.getElementById("sql-section");
  const sqlCode = sqlSection.querySelector("code");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userQuery = input.value.trim();
    if (!userQuery) return;

    // Reset UI and show loader
    resetUI();
    loader.style.display = "flex";
    submitBtn.disabled = true;

    // Show spinner and hide arrow
    const arrowIcon = document.getElementById("arrow-icon");
    const spinnerIcon = document.getElementById("spinner-icon");
    if (arrowIcon && spinnerIcon) {
      arrowIcon.classList.add("hidden");
      spinnerIcon.classList.remove("hidden");
    }

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userQuery }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData.details || errData.error || "An unknown error occurred."
        );
      }

      const result = await response.json();
      displayResults(result);
    } catch (error) {
      displayError(error.message);
    } finally {
      // Hide loader and re-enable button
      loader.style.display = "none";
      submitBtn.disabled = false;

      // Show arrow and hide spinner
      const arrowIcon = document.getElementById("arrow-icon");
      const spinnerIcon = document.getElementById("spinner-icon");
      if (arrowIcon && spinnerIcon) {
        arrowIcon.classList.remove("hidden");
        spinnerIcon.classList.add("hidden");
      }
    }
  });

  function resetUI() {
    errorContainer.style.display = "none";
    summarySection.style.display = "none";
    tableSection.style.display = "none";
    sqlSection.style.display = "none";
    resultsTable.innerHTML = "";
  }

  function displayError(message) {
    errorMessage.textContent = message;
    errorContainer.style.display = "block";
  }

  function displayResults({ data, summary, sql }) {
    // Display Summary
    summaryText.textContent = summary;
    summarySection.style.display = "block";

    // Display SQL
    sqlCode.textContent = sql;
    sqlSection.style.display = "block";

    // Display Table Data
    if (data && data.length > 0) {
      tableSection.style.display = "block";
      generateTable(data);
    }
  }

  function generateTable(data) {
    const headers = Object.keys(data[0]);

    // Create table head
    const thead = document.createElement("thead");
    thead.className = "bg-gray-50";
    let headerRow = "<tr>";
    headers.forEach((header) => {
      headerRow += `<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${header.replace(
        /_/g,
        " "
      )}</th>`;
    });
    headerRow += "</tr>";
    thead.innerHTML = headerRow;

    // Create table body
    const tbody = document.createElement("tbody");
    tbody.className = "bg-white divide-y divide-gray-200";
    data.forEach((row) => {
      let tableRow = "<tr>";
      headers.forEach((header) => {
        let value = row[header];
        // Format date and numeric values for better readability
        if (
          typeof value === "string" &&
          value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        ) {
          value = new Date(value).toLocaleString("en-US", {
            timeZone: "America/Los_Angeles",
          });
        } else if (typeof value === "number" && !Number.isInteger(value)) {
          value = value.toFixed(2);
        }
        tableRow += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${
          value !== null ? value : "N/A"
        }</td>`;
      });
      tableRow += "</tr>";
      tbody.innerHTML += tableRow;
    });

    resultsTable.append(thead, tbody);
  }
});
