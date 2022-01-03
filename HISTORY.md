3.0.1
=====

* Version 3.0.0 was skipped due to a mistake in tagging the previous version.
* Updated dependencies.

Please see the previous releases for the full list of changes in this
development cycle.

3.0.1-rc.1
==========

* Rebranded fully to Genie [#289].
* The Genie platform was updated to version 0.9.0, bringing numerous improvements.
* Audio support is now provided by the separate genie-client package. A client
  is spawned automatically in the same container as the server, if PulseAudio is
  available [#285, #288, #299].
* Added support for PKCE OAuth authentication [#224].
* The codebase was migrated to TypeScript [#215].
* Misc bug fixes [#263, #265].
* Misc build system fixes [#201, #250, #276, ]
* Updated dependencies [#219, #220, #221, #223, #225, #226, #227, #229, #230, #231,
  #232, #233, #234, #235, #247, #251, #258, #260, #261, #262, #266, #268, #270,
  #274, #285, #287, #291].

2.0.1
=====

* OAuth inside the Home Assistant add-on now should work fully without issues,
  and without resorting to opening a separate port [#214].
* Misc UI improvements [#208].
* Documentation fixes [#212, #213].

Contributors to this release:
- Ashton Eby
- Francesco Galuppi

2.0.0
=====

* The UI has been refreshed, with a better looking conversation widget
  and nicer view in My Skills [#189, #198, #199, #200, #204, #206].
* Misc bug fixes [#191, #203].
* Updated dependencies [#207, #210].

Contributors to this release:
- Philip Allgaier
- Francesco Galuppi
- Antonio Muratore

Please see the previous release for the full list of changes in this
development cycle.

2.0.0-beta.1
============

* Improved support for sound effects in skills that use them (like SmartNews)
  [#173, #184]
* Added support for automatically configuring ducking and echo cancellation
  at startup [#170, #171, #176].
* Almond now shows the consent form upon initial configuration [#181].
* Added a link to the Thingpedia cheatsheet in the navbar [#184].
* Misc bug fixes [#174, #177, #184].
* Updated dependencies [#175, #178, #179, #180, #188].
* Build system fixes [#172].

Contributors to this release:
- Francesco Galuppi
- Antonio Muratore

2.0.0-alpha.1
=============

This is the first Alpha release of the Almond 2.0 release cycle. It brings
the latest version of the Almond platform, with several improvements across
the board. The high-level list of changes is available on the
[release page](https://wiki.almond.stanford.edu/en/release-planning/two-point-oh).

Among the almond-server specific changes are:

* The home page was removed. Almond now opens directly with the conversation.
* A new recording mode was added, that allows detailed recordings to be made
  of dialogues as they occur, including the full content of all executed ThingTalk
  programs and the replies from the agent. These recording can be used for
  testing and debugging.
* A new platform device was added that allows to control the volume of the main
  speaker.
* Voice input and output are now configurable from the Configuration page.
* Wake-word recognition was made more reliable, and has now fewer spurious wake ups.
* Conversation history is now shared across all browser sessions, regardless of
  which host is used to access Almond.
* API endpoints and browser endpoints have been separated, solving a number of
  Origin-related issues when Almond is configured with a reverse proxy or inside
  Home Assistant. API endpoints can now be optionally configured with an access
  token instead of host authentication.

1.99.0
======

* Updated dependencies [#100, #101].

Please see the 1.99.0 development releases below for the full list of features
and changes in this release.

1.99.0-rc.1
===========

* Updated dependencies, fixing a number of issues in Genie.

1.99.0-beta.1
=============

This is the first release to use the new Genie Toolkit as the core dialogue
system, replacing both the Almond dialogue agent and the ThingEngine. Genie
supports multi-turn interactions.

You can learn more about this release at
<https://wiki.almond.stanford.edu/en/release-planning/one-point-ninetynine>.

* Configuration has been updated to work better under various network
  conditions [#97].
* OAuth devices are now supported, by proxying the OAuth flow through our
  website [#97]
* The codebase was relicensed to Apache 2.0 [#89].
* Sound support was refactored and made more robust [#89, #97]
* It is now possible to override the locale used by the server with a new
  `LOCALE` environment variable [#93].
* Updated dependencies [#59, #60, #63, #64, #65, #66, #68, #69, #71, #72, #73,
  #74, #75, #76, #77, #81, #82, #83, #84, #85, #86, #87, #89, #90, #92].

1.8.0
=====

* Several attempts were made to make the docker build more reliable
  (especially around snowboy) [#50, #51, #52, #55, #56, #58]

1.8.0-beta.1
============

* The Almond platform was updated to the 1.8 series [#54].
* The wake word implementation was changed to snowboy. This reduced the app
  on-disk footprint, and made the app easier to install. As part of this
  change, the wake word is now "computer" [#53].
* The speech-to-text backend was changed and now uses Microsoft Speech API,
  significantly improving the voice quality [#53].

1.7.3
=====

* Almond can now run on Windows as a native application (without
  WSL or docker). This should improve development of Almond on Windows [#45].
* Updated dependencies. In particular, this brings new support for
  customizable temperature units. For now, this must be configured
  manually. A UI will be added in the future [#40, #48].

1.7.2
=====

* Updated dependencies

1.7.1
=====

* The main conversation is now delayed until the page is opened
  if speech is not available, allowing to show the welcome screen
* Updated dependencies

1.7.0
=====

This is the first stable release of almond-server, the single-user
home server version of Almond. The version number is chosen to align
with the rest of the Almond platform.
