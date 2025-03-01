# RxPlayer Releases

## Types of releases

The RxPlayer has several types of releases:

-   Official releases, which are the main releases published on `npm` and
    whose releases notes are [published on GitHub](https://github.com/canalplus/rx-player/releases).

    Those releases have been thoroughly tested, and in most cases even ran in
    production for some time with no discovered issue.

    Official releases are named following [semantic versionning](https://semver.org/)
    under a very simple `MAJOR.MINOR.PATCH` name.

    Examples:

    ```
    3.30.1
    1.2.1
    4.0.0
    ```

    When published on `npm`, we do not specify any specific tag, like we do for
    other types of releases. This lead official releases to be branded under the
    default `latest` tag by `npm`.

-   `dev` releases, which are pre-releases made with the latest features, bug
    fixes and improvements. Those can be made very quickly and as such are ideal
    when wanting to perform tests before including the corresponding
    developments in an official release.

    However, we have less stability guarantees than for official releases.

    `dev` releases are also named following [semantic versionning](https://semver.org/)
    beginning with the version of the next official releases it could be
    released as (for example, if it only include patches on top of the previous
    official release, only the `PATCH` part of that release should be
    incremented).

    Then we add to it the `-dev.` string, followed by the date in a YYYYMMDD
    format (e.g. `20230425` for April 25, 2023) followed by a number on two
    digits, starting at `00`, which is incremented each time a `dev` release
    is made that day.

    Examples:

    ```
    // Patches on top of an official `3.30.1` release, done the 2023-04-25
    3.30.2-dev.2023042500

    // 2nd release adding another patch on top of the previous one the same day
    3.30.2-dev.2023042501

    // New features added on top of a `3.35.2` release
    3.36.0-dev.2023060100
    ```

    When published on `npm`, they have the `dev` tag.

-   `alpha`, `beta`, `rc` releases. Those are pre-releases specifically made
    before a very important official release (such as a new major version).

    `alpha` releases are generally only communicated to Canal+'s applications
    developers and have an API that may change completely from one release to
    another.

    `beta` releases generally have a much more stable API and is used to find
    out the last bugs and friction points for applications. Those are generally
    also documented through release notes on GitHub.

    `rc` (for "release candidate"): are releases that may become the
    corresponding official release if no issue is detected in a sufficiently
    long time.
    Like for `beta` releases, those are documented through release notes on
    GitHub.

    All those kinds of releases are named following semantic versionning of the
    final official release, followed by `-alpha`, `-beta` or `-rc` respectively
    for an `alpha`, `beta` and `rc` release, then followed by a dot (`.`) and
    then by a number starting at `0` then incrementing at each new release of
    that type.

    Examples:

    ```
    // first alpha release for a future v5.0.0
    v5.0.0-alpha.0

    // Third alpha release for a future v5.0.0
    v5.0.0-alpha.2

    // Second beta release for a future v5.0.0
    v5.0.0-beta.1

    // First rc release for a future v5.0.0
    v5.0.0-rc.1
    ```

    When published on `npm`, they all have the `next` tag.

-   `canal` releases are similar to `dev` releases, with added work-arounds and
    features that are intended for Canal+ internal usage only. Either because
    they work-around very specific Canal+ bugs (for example, known specific
    badly-packaged contents) or because we're currently testing features we're
    not sure about adding to a future release yet (such as for features which
    are "risky" in terms of stability and compatibility).

    They are created both when a project at Canal+ (or one of its partners)
    demands it, and after each official releases.

    They are named exactly the same way than `dev` releases, excepted with
    `-canal` instead of `-dev` in their name.

    When published on `npm`, they have the `canal` tag.

## Workflow for an official release

Before each official releases, a list of steps are performed by its maintainers:

1. Checkout the branch that will be the base of the next release: generally it
   is either `master` (for patch releases) or `next` (for minor versions).

2. Rebase that branch on the `master` branch if it is a different branch
   (e.g.: `git rebase master --rebase-merges`).

3. From there, create a branch named `release/vXX.XX.XX`, where XX.XX.XX is the
   semver of the wanted new version.

4. Update `CHANGELOG.md` file to add this new version's changelog and commit it.

5. Call the npm script `update-version` for that release (`npm run update-version XX.XX.XX`,
   where XX.XX.XX is the wanted new version SEMVER).

6. Check that the modifications it did make sense and create a signed commit
   (`-S` option when commiting with git) updating the staged built files in step
   `8`.

7. Open a Pull Request on Github, named after the branch, putting the release's
   changelog in the Pull Request's comment, and optional additional comments.

8. Check that sonarcloud validated that branch. Resolve every bug and code
   smells it finds.

9. Ensure that the CI doesn't detect any issue and fix them if that's the case.

10. Run sanity checks on myCanal's repository, by using this new version instead
    as a dependency.

11. If and only if no problem was seen perform a signed merge without
    fast-forward of the release branch into master (`git merge -S --no-ff release/vXX.XX.XX master`)

12. Launch script to update the gh-pages demo (`./scripts/update_gh-pages_demo`)

13. Launch script to update the gh-pages doc (`./scripts/update_gh-pages_doc`)

14. Check that both of those worked, perform manual updates and update the
    concerned scripts in other cases.

15. Check that the new demo and the new doc work as expected

16. If all seems good, push to origin/master your local master branch.

17. run `npm publish` to publish the new version on npm's registry.

18. Test that importing this new version doesn't cause bundling issues (you
    may do so through a ad-hoc package, or just myCanal for example).

19. Create the new release through github's interface - don't forget to include
    the built files on it.

If any of the testing steps failed (after step `3`), run the following steps:

1. Fix the problem (!)

2. Create a commit for the fix with a meaningful message.

3. If (and only if) it make sense, update the changelog and create a commit for
   it.

4. Call the npm script `update-version` for that release (`npm run update-version XX.XX.XX`,
   where XX.XX.XX is the wanted new version SEMVER).

5. Check that the modifications of that last step made sense and create a signed
   commit (`-S` option when commiting with git) updating the staged built files.

6. Depending on the nature of the fix, either create a new branch and add a Pull
   Request to merge it in the release branch or push it to the release branch
   directly.

7. Go back to step `8` (sonarcloud + CI) of the previous workflow
