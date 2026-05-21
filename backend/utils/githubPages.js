const axios = require("axios");

async function enableGithubPages({ repoName, githubUrl }) {
  const githubApi = axios.create({
    baseURL: "https://api.github.com",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  const username = process.env.GITHUB_USERNAME;
  
  if (!username) {
    throw new Error("GITHUB_USERNAME not set in .env");
  }

  try {
    // Enable GitHub Pages
    await githubApi.post(`/repos/${username}/${repoName}/pages`, {
      source: {
        branch: "main",
        path: "/",
      },
    });

    // Get the pages URL
    const pagesResponse = await githubApi.get(`/repos/${username}/${repoName}/pages`);
    
    return {
      pagesUrl: pagesResponse.data.html_url || `https://${username}.github.io/${repoName}`,
    };
  } catch (error) {
    console.log("GitHub Pages enable error:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { enableGithubPages };