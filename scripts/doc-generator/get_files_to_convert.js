const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

// /**
//  * Returns information about every Markdown files we have to convert to HTML
//  * in an array.
//  *
//  * The returned Array contains Objects with the following keys:
//  *   - inputFile {string}: normalized absolute path to the markdown file to
//  *     convert
//  *   - outputFile {string}: normalized absolute path to where the resulting
//  *     HTML file should be stored
//  * @param {string} baseInDir - The directory where the markdown files are. This
//  * directory will be checked for files recursively.
//  * @param {string} baseOutDir - The directory where the resulting HTML files
//  * will reside.
//  * @param {Object} [opts = {}]
//  * @param {Function|undefined} opts.fileFilter
//  * @returns {Promise.<Array.<Object>>}
//  */
// module.exports = async function getFilesToConvert(
//   baseInDir,
//   baseOutDir,
//   opts = {},
// ) {
//   const filesToConvert = [];
//   const { fileFilter } = opts;
//   async function recusiveGetFilesToConvert(inputDir, outputDir) {
//     // Loop through all the files in the temp directory
//     let files;
//     try {
//       files = await promisify(fs.readdir)(inputDir);
//     } catch (err) {
//       throw new Error("error while reading directory: " + err);
//     }

//     const filteredFiles = fileFilter != null ?
//       files.filter((fileName) => fileFilter(fileName, baseInDir)) :
//       files;

//     for (let i = 0; i < filteredFiles.length; i++) {
//       const file = filteredFiles[i];
//       const filePath = path.join(inputDir, file);
//       let stat;
//       try {
//         stat = await promisify(fs.stat)(filePath);
//       } catch (err) {
//         throw new Error("error while stating file: " + err);
//       }

//       if (stat.isDirectory()) {
//         const newOutDir = path.join(outputDir, file);
//         await recusiveGetFilesToConvert(filePath, newOutDir);
//       } else if(stat.isFile()) {
//         const extname = path.extname(file);
//         if (extname === ".md") {
//           const outputFile =
//             path.join(outputDir, path.basename(filePath, ".md") + ".html");

//           filesToConvert.push({
//             inputFile: path.normalize(path.resolve(filePath)),
//             outputFile: path.normalize(path.resolve(outputFile)),
//           });
//         }
//       }
//     }
//   }
//   await recusiveGetFilesToConvert(baseInDir, path.join(baseOutDir, "pages"));
//   return filesToConvert;
// };

/**
 *
 * ```
 * {
 *   categories: [{
 *     displayName: "Category 1",
 *     firstPage: "/destination/category_1",
 *     pages: [{
 *       isPageGroup: false,
 *       displayName: "Page 1",
 *       inputFile: "/example/of/path/to/category_1/file.md",
 *       outputFile: "/destination/category_1/file.html",
 *     },
 *     {
 *       isPageGroup: true,
 *       displayName: "Group of pages 1",
 *       pages: [{
 *         isPageGroup: false,
 *         displayName: "Page 1",
 *         inputFile: "/example/of/path/to/category_1/group_1/file.md",
 *         outputFile: "/destination/category_1/group_1/file.html",
 *       }],
 *     }]
 *   }]
 * }
 * ```
 */
module.exports = async function createDocumentationTree(baseInDir, baseOutDir) {
  const rootConfig = await parseRootConfigFile(baseInDir);
  const ret = { categories: [] };

  for (const category of rootConfig.categories) {
    const categoryPath = path.join(baseInDir, category.path);
    const categoryOutPath = path.join(baseOutDir, category.path);
    const parsedCategory = {
      displayName: category.displayName,
      description: category.description,
      firstPage: "",
      pages: [],
    };
    ret.categories.push(parsedCategory);
    const categoryConfig = await parseCategoryConfigFile(categoryPath);
    for (const page of categoryConfig.pages) {
      const pagePath = path.join(categoryPath, page.path);
      let pageStat;
      try {
        pageStat = await promisify(fs.stat)(pagePath);
      } catch (err) {
        throw new Error("error while stating file: " + err);
      }

      if (pageStat.isDirectory()) {
        const parsedPage = {
          isPageGroup: true,
          displayName: page.displayName,
          description: path.description,
          pages: [],
        };
        parsedCategory.pages.push(parsedPage);
        const pageGroupConfig = await parseCategoryConfigFile(pagePath);
        for (const subPage of pageGroupConfig.pages) {
          const subPagePath = path.join(pagePath, subPage.path);
          const subPageOutPath = path.join(categoryOutPath, subPage.path);
          let subPageState;
          try {
            subPageState = await promisify(fs.stat)(subPagePath);
          } catch (err) {
            throw new Error("error while stating file: " + err);
          }

          if (subPageState.isDirectory()) {
            throw new Error(
              "Category page depth cannot exceed 2 and `" +
              subPagePath + "` is a directory."
            );
          }
          const outputFile =
            path.join(subPageOutPath, path.basename(subPagePath, ".md") + ".html");
          parsedPage.pages.push({
            isPageGroup: false,
            displayName: subPage.displayName,
            description: subPage.description,
            inputFile: path.normalize(path.resolve(subPagePath)),
            outputFile: path.normalize(path.resolve(outputFile)),
          });
        }
      } else if(pageStat.isFile()) {
        const outputFile =
          path.join(categoryOutPath, path.basename(pagePath, ".md") + ".html");
        parsedCategory.pages.push({
          isPageGroup: false,
          displayName: page.displayName,
          description: page.description,
          inputFile: path.normalize(path.resolve(pagePath)),
          outputFile: path.normalize(path.resolve(outputFile)),
        });
      }
    }
    // XXX TODO
    parsedCategory.firstPage = parsedCategory.pages[0].outputFile;
  }
  return ret;
};

/**
 * @param {string} baseInDir
 * @returns {Promise.<Object>}
 */
async function parseRootConfigFile(baseInDir) {
  let rootConfigStr;
  try {
    const rootConfigFileName = path.join(baseInDir, ".docConfig.json");
    rootConfigStr = await promisify(fs.readFile)(rootConfigFileName, "utf8");
  } catch (err) {
    throw new Error("Error when trying to read root .docConfig.json:", err);
  }

  let rootConfigJson;
  try {
    rootConfigJson = JSON.parse(rootConfigStr);
  } catch (err) {
    throw new Error("Error when trying to parse root .docConfig.json:", err);
  }

  if (
    !Array.isArray(rootConfigJson.categories) ||
    rootConfigJson.categories.length === 0
  ) {
    throw new Error("Invalid root .docConfig.json file: no `categories`");
  }

  for (const category of rootConfigJson.categories) {
    if (typeof category.path !== "string") {
      throw new Error(
        "Invalid root .docConfig.json file: one of the category has no valid " +
          "`path` property"
      );
    } else if (typeof category.displayName !== "string") {
      throw new Error(
        "Invalid root .docConfig.json file: one of the category has no valid " +
          "`displayName` property"
      );
    }
  }
  return rootConfigJson;
}

/**
 * @param {string} categoryDir
 * @returns {Promise.<Object>}
 */
async function parseCategoryConfigFile(categoryDir) {
  let configStr;
  try {
    const filename = path.join(categoryDir, ".docConfig.json");
    configStr = await promisify(fs.readFile)(filename, "utf8");
  } catch (err) {
    throw new Error(`Error when trying to read ${filename}:`, err);
  }

  let configObj;
  try {
    configObj = JSON.parse(configStr);
  } catch (err) {
    throw new Error("Error when trying to parse root .docConfig.json:", err);
  }

  if (
    !Array.isArray(configObj.pages) ||
    configObj.pages.length === 0
  ) {
    throw new Error("Invalid root .docConfig.json file: no `pages`");
  }

  for (const page of configObj.pages) {
    if (typeof page.path !== "string") {
      throw new Error(
        "Invalid root .docConfig.json file: one of the page has no valid " +
          "`path` property"
      );
    } else if (typeof page.displayName !== "string") {
      throw new Error(
        "Invalid root .docConfig.json file: one of the page has no valid " +
          "`displayName` property"
      );
    }
  }
  return configObj;
}

// ```js
// {
//   // Different documentation "Categories", which are their own separate
//   // group of documentation pages.
//   // Those are in the order that we want to display them.
//   //
//   // The default page used for this category should be the very first
//   // page anounced in it (which can be part of a "page group").
//   categories: [
//     {
//       // Name of the category that should be displayed
//       // Examples could be: "Getting Started" or "API"
//       displayName: "Category 1",
//
//       // List of documentation "pages" in that directory, in order at which
//       // we want to display them.
//       pages: [
//         {
//           // If `false` this object represents a documentation page.
//           // In that case this object will have an `inputFile` and
//           // `outputFile` property (documented here).
//           //
//           // If `true` this Object represents a "page group", that is, it
//           // regroups multiple documentation pages.
//           // Here the `pages` property would indicate which pages (and in
//           // which order) are part of this page group.
//           // Note that a page group cannot contain another page group.
//           isPageGroup: false,
//
//           // Name that should be displayed for that page
//           displayName: "Page 1",
//
//           inputFile: "/example/of/path/to/file.md",
//           outputFile: "/destination/file.html",
//         }
//
//         // second element, to showcase a page group
//         {
//           isPageGroup: true,
//
//           // Name that should be displayed for that group
//           displayName: "Group of pages 1",
//
//           // Pages in  that page group
//           pages: [ {
//             // Note: cannot be `true` as we're already in a page group
//             isPageGroup: false,
//
//             // Name that should be displayed for that page
//             displayName: "Page 1",
//
//             inputFile: "/example/of/path/to/file.md",
//             outputFile: "/destination/file.html",
//
//           } ],
//         }
//       ]
//     }
//   ]
// }
// ```
