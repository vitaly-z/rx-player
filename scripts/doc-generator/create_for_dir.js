const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const createDocumentationTree = require("./get_files_to_convert.js");
const mkdirParent = require("./mkdir_parent.js");
const createDocumentationPage = require("./create_page.js");

async function createDirIfDoesntExist(dir) {
  const doesCSSOutDirExists = await promisify(fs.exists)(dir);
  if (!doesCSSOutDirExists) {
    await mkdirParent(dir);
  }
}

/**
 * Create documentation for the directory given into the ouput directory given.
 * @param {string} baseInDir
 * @param {string} baseOutDir
 * @param {Object} [options={}]
 * @param {Function} [options.getPageTitle] - Callback returning the name of the
 * page, based on the name of a single markdown document.
 * If not set, the page title will just be the corresponding markdown's title.
 * @param {Array.<string>} [options.css] - Optional CSS files which will be
 * linked to each generated page.
 * Should be the path to each of those.
 * @param {Function|undefined} [options.beforeParse] - Callback which will be
 * called on each markdown document just before transforming it into HTML.
 * Takes in argument the markdown content (as a string) and should return the
 * markdown document you want to convert into HTML (also as a string).
 * If not set, each markdown document will be converted as is.
 * @returns {Promise} - Resolve when done
 */
module.exports = async function createDocumentationForDir(
  baseInDir,
  baseOutDir,
  options = {},
) {
  const { css } = options;

  // Copy CSS files
  const cssOutputDir = path.join(path.resolve(baseOutDir), "styles");
  const cssOutputPaths = css.map(cssFilepath => {
    return path.join(cssOutputDir, path.basename(cssFilepath));
  });

  if (css.length > 0) {
    await createDirIfDoesntExist(cssOutputDir);
    await Promise.all(css.map(async (cssInput, i) => {
      await promisify(fs.copyFile)(cssInput, cssOutputPaths[i]);
    }));
  }

  // Construct tree listing categories, pages, and relations between them.
  const docTree = await createDocumentationTree(baseInDir, baseOutDir);

  // Construct a dictionary of markdown files to the corresponding output file.
  // This can be useful to redirect links to other converted markdowns.
  const fileDict = docTree.categories.reduce((acc, categoryInfo) => {
    return categoryInfo.pages.reduce((acc2, pageInfo) => {
      if (pageInfo.isPageGroup) {
        return pageInfo.pages.reduce((acc3, subPageInfo) => {
          acc3[subPageInfo.inputFile] = subPageInfo.outputFile;
          return acc3;
        }, acc2);
      } else {
        acc2[pageInfo.inputFile] = pageInfo.outputFile;
      }
      return acc2;
    }, acc);
  }, {});

  // Create documentation pages
  for (let categoryIdx = 0; categoryIdx < docTree.categories.length; categoryIdx++) {
    const currentCategory = docTree.categories[categoryIdx];
    for (let pageIdx = 0; pageIdx < currentCategory.pages.length; pageIdx++) {
      const currentPage = currentCategory.pages[pageIdx];
      if (!currentPage.isPageGroup) {
        const { inputFile, outputFile } = currentPage;
        await generateDocumentationPage(
          inputFile,
          outputFile,
          docTree.categories,
          categoryIdx,
          currentCategory.pages,
          [pageIdx],
          cssOutputPaths,
          fileDict,
          options
        );
      } else {
        for (
          let subPageIdx = 0;
          subPageIdx < currentPage.pages.length;
          subPageIdx++
        ) {
          const currentSubPage = currentPage.pages[subPageIdx];
          const { inputFile, outputFile } = currentSubPage;
          await generateDocumentationPage(
            inputFile,
            outputFile,
            docTree.categories,
            categoryIdx,
            currentCategory.pages,
            [pageIdx, subPageIdx],
            cssOutputPaths,
            fileDict,
            options
          );
        }
      }
    }
  }
};

async function generateDocumentationPage(
  inputFile,
  outputFile,
  categories,
  categoryIdx,
  pages,
  pageIdxs,
  cssOutputPaths,
  fileDict,
  options
) {
  const { getPageTitle = t => t,
          beforeParse } = options;
  // Create output directory if it does not exist
  const outDir = path.dirname(outputFile);
  await createDirIfDoesntExist(outDir);

  const navBarHtml = constructNavigationBar(
    categories,
    categoryIdx,
    outputFile
  );
  const sidebarHtml = constructSidebar(
    pages,
    pageIdxs,
    outputFile
  );
  const cssRelativePaths =
    cssOutputPaths.map(cssOutput => path.relative(outDir, cssOutput));

  // add link translation to options
  const linkTranslator = linkTranslatorFactory(inputFile, outDir, fileDict);
  await createDocumentationPage(inputFile,
                                outputFile,
                                { linkTranslator,
                                  getPageTitle,
                                  beforeParse,
                                  navBarHtml,
                                  sidebarHtml,
                                  css: cssRelativePaths });
}

function constructNavigationBar(categories, currentCategoryIndex, currentPath) {
  const links = categories.map((c, i) => {
    let relativePath = path.relative(path.dirname(currentPath), c.firstPage);
    if (relativePath[0] != ".") {
      relativePath = "./" + relativePath;
    }
    const activeClass = i === currentCategoryIndex ? " navbar-active" : "";
    // XXX TODO html-entities
    return `<a class="navbar-item${activeClass}"` +
      `href="${relativePath}">${c.displayName}</a>`;
  }).join("\n      ");
  return `<nav class="navbar-parent">
  <div class="navbar-wrapper">
    <div class="navbar-items">
      ${links}
    </div>
  </div>
</nav>`;
};

function constructSidebar(pages, currentPageIndexes, currentPath) {
  const links = pages.map((p, i) => {
    const isActive = i === currentPageIndexes[0];
    if (!p.isPageGroup) {
      return generateLiForPage(p, isActive);
    } else {
      const lis = p.pages.map((sp, j) => {
        const isActiveSubPage = isActive && j === currentPageIndexes[1];
        return generateLiForPage(sp, isActiveSubPage);
      }).join("");
      return `<li class="sidebar-item">` +
        p.displayName +
        `<ul>${lis}</ul>` +
        "</li>";

    }
  }).join("");
  return `<aside class="sidebar-parent">` +
    `<div class="sidebar-wrapper">` +
    `<div class="sidebar-items">${links}</div>` +
    "</div>" +
    "</aside>";

  function generateLiForPage(p, isActive) {
    let relativePath = path.relative(path.dirname(currentPath), p.outputFile);
    if (relativePath[0] != ".") {
      relativePath = "./" + relativePath;
    }
    const activeClass = isActive ? " sidebar-active" : "";
    // XXX TODO html-entities
    return `
      <li class="sidebar-item">
        <a class="sidebar-link${activeClass}" href="${relativePath}">${p.displayName}</a>
      </li>`;
  }
}

/**
 * Generate linkTranslator functions
 * @param {string} inputFile
 * @param {Object} fileDict
 * @returns {Function}
 */
function linkTranslatorFactory(inputFile, outputDir, fileDict) {
  /**
   * Convert links to files that will be converted to the links of the
   * corresponding converted output files.
   * @param {string} link
   * @returns {string}
   */
  return (link) => {
    const extname = path.extname(link);
    const indexOfAnchor = extname.indexOf("#");

    const anchor = indexOfAnchor > 0 ?
      extname.substring(indexOfAnchor) :
      "";

    const linkWithoutAnchor = link.substring(0, link.length - anchor.length);

    const completeLink = path.join(path.dirname(inputFile), linkWithoutAnchor);
    const normalizedLink = path.normalize(path.resolve(completeLink));

    const translation = fileDict[normalizedLink];
    return translation ?
      path.relative(outputDir, translation + anchor) :
      link;
  };
}
