document.addEventListener("DOMContentLoaded", () => {
  const instructorsList = document.getElementById("instructors-list");
  const domainsList = document.getElementById("domains-list");
  const classesList = document.getElementById("classes-list");

  // Function to fetch data and populate a list
  const populateList = async (element, endpoint, fieldName) => {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();

      element.innerHTML = ""; // Clear loading text
      data.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item[fieldName];
        element.appendChild(li);
      });
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error);
      element.innerHTML = "<li>Could not load data.</li>";
    }
  };

  // Fetch all data
  populateList(instructorsList, "/api/instructors", "instructor_name");
  populateList(domainsList, "/api/domains", "domain_name");
  populateList(classesList, "/api/classes", "class_name");
});
