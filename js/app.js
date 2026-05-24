const searchBtn = document.getElementById("searchBtn");
const compareBtn = document.getElementById("compareBtn");
const addUserBtn = document.getElementById("addUserBtn");
const clearComparisonBtn = document.getElementById("clearComparisonBtn");
const themeBtn = document.getElementById("themeBtn");

let chart;
let comparisonUsers = [];

// Analyze single user
searchBtn.addEventListener("click", async () => {
  const username = document.getElementById("username").value;

  if(username === ""){
    alert("Enter username");
    return;
  }

  try{
    // User Info
    const userResponse = await fetch(
      `https://codeforces.com/api/user.info?handles=${username}`
    );

    const userData = await userResponse.json();
    const user = userData.result[0];

    document.getElementById("profile").classList.remove("hidden");
    document.getElementById("avatar").src = user.titlePhoto;
    document.getElementById("name").innerText = user.handle;
    document.getElementById("rating").innerText = user.rating || "Unrated";
    document.getElementById("maxRating").innerText = user.maxRating || "-";
    document.getElementById("rank").innerText = user.rank || "-";
    document.getElementById("solvedCount").innerText = "Loading...";

    // Fetch solved problem count
    const statusResponse = await fetch(
      `https://codeforces.com/api/user.status?handle=${username}&from=1&count=100000`
    );
    const statusData = await statusResponse.json();
    if(statusData.status === "OK"){
      const solvedProblems = new Set();
      statusData.result.forEach(submission => {
        if(submission.verdict === "OK"){
          const prob = submission.problem;
          solvedProblems.add(`${prob.contestId}-${prob.index}`);
        }
      });
      document.getElementById("solvedCount").innerText = solvedProblems.size;
    } else {
      document.getElementById("solvedCount").innerText = "-";
    }

    // Contest History
    const contestResponse = await fetch(
      `https://codeforces.com/api/user.rating?handle=${username}`
    );

    const contestData = await contestResponse.json();
    const contests = contestData.result;

    document.getElementById("contestSection").classList.remove("hidden");
    const table = document.getElementById("contestTable");
    table.innerHTML = "";

    const labels = [];
    const ratings = [];

    contests.slice(10).reverse().forEach(contest => {
      labels.push(contest.contestName);
      ratings.push(contest.newRating);

      table.innerHTML += `
        <tr>
          <td>${new Date(contest.ratingUpdateTimeSeconds * 1000).toLocaleDateString()}</td>
          <td>${contest.contestName}</td>
          <td>${contest.oldRating}</td>
          <td>${contest.newRating}</td>
        </tr>
      `;
    });

    labels.reverse();
    ratings.reverse();

    // Chart
    document.getElementById("chartSection").classList.remove("hidden");
    const ctx = document.getElementById("ratingChart");

    if(chart){
      chart.destroy();
    }

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Rating",
          data: ratings,
          tension: 0.3
        }]
      }
    });

  }catch(error){
    alert("User not found");
    console.log(error);
  }
});

// Compare button
compareBtn.addEventListener("click", () => {
  document.getElementById("compareSection").classList.remove("hidden");
  document.getElementById("profile").classList.add("hidden");
  document.getElementById("contestSection").classList.add("hidden");
  document.getElementById("compareUsername").value = "";
});

// Add user to comparison
addUserBtn.addEventListener("click", async () => {
  const username = document.getElementById("compareUsername").value;

  if(username === ""){
    alert("Enter username");
    return;
  }

  const normalizedHandle = username.toLowerCase();
  if(comparisonUsers.some(u => u.normalized === normalizedHandle)){
    alert("User already added");
    return;
  }

  try{
    const contestResponse = await fetch(
      `https://codeforces.com/api/user.rating?handle=${username}`
    );

    const contestData = await contestResponse.json();
    if(!contestData.result){
      alert("User not found");
      return;
    }

    comparisonUsers.push({ handle: username, normalized: normalizedHandle });
    document.getElementById("compareUsername").value = "";
    updateComparisonDisplay();
    generateComparisonChart();

  }catch(error){
    alert("User not found");
  }
});

// Update display of selected users
function updateComparisonDisplay(){
  const selectedUsersDiv = document.getElementById("selectedUsers");
  selectedUsersDiv.innerHTML = "";

  comparisonUsers.forEach(user => {
    const tag = document.createElement("div");
    tag.className = "user-tag";
    tag.innerHTML = `
      ${user.handle}
      <button onclick="removeUser('${user.normalized}')">✕</button>
    `;
    selectedUsersDiv.appendChild(tag);
  });
}

// Remove user from comparison
function removeUser(normalizedHandle){
  comparisonUsers = comparisonUsers.filter(u => u.normalized !== normalizedHandle);
  updateComparisonDisplay();
  if(comparisonUsers.length > 0){
    generateComparisonChart();
  } else {
    if(chart) chart.destroy();
    document.getElementById("chartSection").classList.add("hidden");
  }
}

// Generate comparison chart
async function generateComparisonChart(){
  if(comparisonUsers.length === 0){
    if(chart) chart.destroy();
    document.getElementById("chartSection").classList.add("hidden");
    return;
  }

  const userRatings = [];
  const allDates = new Set();

  for(let user of comparisonUsers){
    try{
      const response = await fetch(
        `https://codeforces.com/api/user.rating?handle=${user.handle}`
      );

      const data = await response.json();
      const contests = data.result || [];

      const ratingsByDate = {};
      contests.slice(10).reverse().forEach(contest => {
        const dateLabel = new Date(contest.ratingUpdateTimeSeconds * 1000).toLocaleDateString();
        ratingsByDate[dateLabel] = contest.newRating;
        allDates.add(dateLabel);
      });

      userRatings.push({
        handle: user.handle,
        ratingsByDate
      });
    }catch(error){
      console.log(error);
    }
  }

  const labels = Array.from(allDates).sort((a,b) => new Date(a) - new Date(b));
  const datasets = userRatings.map(user => {
    const data = labels.map(label => user.ratingsByDate[label] ?? null);
    const colors = generateRandomColor();
    return {
      label: user.handle,
      data,
      tension: 0.3,
      borderColor: colors,
      backgroundColor: colors + "33",
      fill: false,
      pointRadius: 3,
      borderWidth: 2,
      spanGaps: true
    };
  });

  document.getElementById("chartSection").classList.remove("hidden");
  const ctx = document.getElementById("ratingChart");

  if(chart){
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets
    },
    options: {
      scales: {
        x: {
          title: {
            display: true,
            text: "Contest Date"
          }
        },
        y: {
          title: {
            display: true,
            text: "Rating"
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}`
          }
        }
      }
    }
  });
}

// Generate random color
function generateRandomColor(){
  const colors = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Clear comparison
clearComparisonBtn.addEventListener("click", () => {
  comparisonUsers = [];
  updateComparisonDisplay();
  document.getElementById("chartSection").classList.add("hidden");
  document.getElementById("compareSection").classList.add("hidden");
  if(chart) chart.destroy();
});

// Theme toggle
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});
