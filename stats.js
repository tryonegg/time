// Statistics Module - Handles calculations and Chart.js rendering

let distributionChart = null;
let timeseriesChart = null;

async function renderStats() {
  const period = document.getElementById('stats-period').value;
  const customRangeDiv = document.getElementById('custom-date-range');

  // Show/hide custom date range inputs
  if (period === 'custom') {
    customRangeDiv.style.display = 'flex';
    customRangeDiv.gap = '1rem';
  } else {
    customRangeDiv.style.display = 'none';
  }

  // Recalculate on period change
  updateStatsCharts();
}

document.addEventListener('DOMContentLoaded', () => {
  const periodSelect = document.getElementById('stats-period');
  const startDateInput = document.getElementById('stats-start-date');
  const endDateInput = document.getElementById('stats-end-date');

  if (periodSelect) {
    periodSelect.addEventListener('change', renderStats);
  }
  if (startDateInput) {
    startDateInput.addEventListener('change', updateStatsCharts);
  }
  if (endDateInput) {
    endDateInput.addEventListener('change', updateStatsCharts);
  }
});

async function updateStatsCharts() {
  const period = document.getElementById('stats-period').value;
  const { startDate, endDate } = getDateRange(period);

  const sessions = await db.getSessions({
    startDate,
    endDate
  });

  // Calculate distribution data
  const distributionData = calculateDistribution(sessions);
  renderDistributionChart(distributionData);

  // Calculate time series data
  const timeseriesData = calculateTimeseries(sessions, startDate, endDate, period);
  renderTimeseriesChart(timeseriesData, period);

  // Render summary table
  renderSummaryTable(sessions);
}

function getDateRange(period) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let startDate, endDate;

  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startDate = new Date(now.getFullYear(), now.getMonth(), diff);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
  } else if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (period === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31);
  } else if (period === 'all') {
    startDate = new Date('2000-01-01');
    endDate = new Date();
  } else if (period === 'custom') {
    const startInput = document.getElementById('stats-start-date').value;
    const endInput = document.getElementById('stats-end-date').value;
    
    if (!startInput || !endInput) {
      // Fallback to this month if dates not set
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
    } else {
      startDate = new Date(startInput);
      endDate = new Date(endInput);
    }
  }

  return { 
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

function calculateDistribution(sessions) {
  const distribution = {};

  sessions.forEach(session => {
    const projectId = session.projectId;
    if (!distribution[projectId]) {
      distribution[projectId] = 0;
    }
    distribution[projectId] += session.duration || 0;
  });

  return distribution;
}

function calculateTimeseries(sessions, startDateStr, endDateStr, period) {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const timeseries = {};

  // Initialize timeseries based on period
  if (period === 'week') {
    const dayOfWeek = startDate.getDay();
    const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(startDate.getFullYear(), startDate.getMonth(), diff);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split('T')[0];
      timeseries[key] = {};
    }
  } else if (period === 'month' || period === 'custom') {
    const current = new Date(startDate);
    while (current <= endDate) {
      const key = current.toISOString().split('T')[0];
      timeseries[key] = {};
      current.setDate(current.getDate() + 1);
    }
  } else if (period === 'year') {
    for (let month = 0; month < 12; month++) {
      const key = `${startDate.getFullYear()}-${String(month + 1).padStart(2, '0')}`;
      timeseries[key] = {};
    }
  } else if (period === 'all') {
    // Group by month
    sessions.forEach(session => {
      const sTime = session.startTime instanceof Date ? session.startTime : new Date(session.startTime);
      const key = `${sTime.getFullYear()}-${String(sTime.getMonth() + 1).padStart(2, '0')}`;
      if (!timeseries[key]) {
        timeseries[key] = {};
      }
    });
  }

  // Aggregate session durations
  sessions.forEach(session => {
    const projectId = session.projectId;
    const sTime = session.startTime instanceof Date ? session.startTime : new Date(session.startTime);
    
    let key;
    if (period === 'year') {
      key = `${sTime.getFullYear()}-${String(sTime.getMonth() + 1).padStart(2, '0')}`;
    } else if (period === 'all') {
      key = `${sTime.getFullYear()}-${String(sTime.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = sTime.toISOString().split('T')[0];
    }

    if (timeseries[key]) {
      if (!timeseries[key][projectId]) {
        timeseries[key][projectId] = 0;
      }
      timeseries[key][projectId] += session.duration || 0;
    }
  });

  return timeseries;
}

async function renderDistributionChart(distributionData) {
  const ctx = document.getElementById('distribution-chart').getContext('2d');
  const projects = await db.getProjects();
  
  const labels = [];
  const data = [];
  const backgroundColor = [];

  Object.entries(distributionData).forEach(([projectId, duration]) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      labels.push(project.name);
      data.push(Math.floor(duration / 60000)); // Convert to minutes
      backgroundColor.push(project.color);
    }
  });

  if (distributionChart) {
    distributionChart.destroy();
  }

  distributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor,
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 14
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const minutes = context.parsed;
              const hours = Math.floor(minutes / 60);
              const mins = minutes % 60;
              return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
            }
          }
        }
      }
    }
  });
}

async function renderTimeseriesChart(timeseriesData, period) {
  const ctx = document.getElementById('timeseries-chart').getContext('2d');
  const projects = await db.getProjects();
  
  const labels = Object.keys(timeseriesData).sort();
  const datasets = [];

  // Create dataset for each project
  projects.forEach(project => {
    const data = labels.map(label => {
      const projectData = timeseriesData[label][project.id] || 0;
      return Math.floor(projectData / 60000); // Convert to minutes
    });

    // Only add dataset if it has data
    if (data.some(d => d > 0)) {
      datasets.push({
        label: project.name,
        data,
        backgroundColor: project.color,
        borderColor: project.color,
        borderWidth: 1,
        borderRadius: 4,
        tension: 0.3
      });
    }
  });

  if (timeseriesChart) {
    timeseriesChart.destroy();
  }

  // Format labels based on period
  const formattedLabels = labels.map(label => {
    if (period === 'week') {
      const date = new Date(label);
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    } else if (period === 'month') {
      const date = new Date(label);
      return date.toLocaleDateString([], { day: 'numeric' });
    } else if (period === 'year' || period === 'all' || period === 'custom') {
      return label;
    }
    return label;
  });

  timeseriesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: formattedLabels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'x',
      scales: {
        x: {
          stacked: true,
          ticks: {
            maxRotation: 45,
            minRotation: 0
          }
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: 'Minutes'
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 14
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const minutes = context.parsed.y;
              const hours = Math.floor(minutes / 60);
              const mins = minutes % 60;
              return context.dataset.label + ': ' + (hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
            }
          }
        }
      }
    }
  });
}

async function renderSummaryTable(sessions) {
  const tbody = document.getElementById('summary-tbody');
  const projects = await db.getProjects();
  tbody.innerHTML = '';

  if (sessions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">No data for this period</td></tr>';
    return;
  }

  // Calculate summary
  const summary = {};
  sessions.forEach(session => {
    if (!summary[session.projectId]) {
      summary[session.projectId] = {
        sessions: 0,
        totalTime: 0
      };
    }
    summary[session.projectId].sessions++;
    summary[session.projectId].totalTime += session.duration || 0;
  });

  // Sort by project name
  const sortedProjectIds = Object.keys(summary).sort((a, b) => {
    const projectA = projects.find(p => p.id === a);
    const projectB = projects.find(p => p.id === b);
    return (projectA?.name || '').localeCompare(projectB?.name || '');
  });

  sortedProjectIds.forEach(projectId => {
    const project = projects.find(p => p.id === projectId);
    const data = summary[projectId];
    const minutes = Math.floor(data.totalTime / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <span style="display: inline-block; width: 12px; height: 12px; background-color: ${project?.color || '#ddd'}; border-radius: 2px; margin-right: 8px;"></span>
        ${project?.name || 'Unknown'}
      </td>
      <td>${data.sessions}</td>
      <td>${timeStr}</td>
    `;
    tbody.appendChild(row);
  });
}
