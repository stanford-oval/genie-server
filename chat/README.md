# Almond Chat Interface

![](/images/screenshot.png)

A chat interface for Almond, an open-source virtual assitant developed at Stanford by the [Open Virtual Assistant Lab](https://oval.cs.stanford.edu).

## Setup

To use this, first create an Almond developer account [here](https://almond.stanford.edu/user/register). Next, log in to your account and click on [Settings](https://almond.stanford.edu/user/profile) on the top right. Scroll down to "Authorized third-party apps" and click "Issue an Access Token". Copy and paste this access token into a `.env` file under the `REACT_APP_ACCESS_TOKEN` variable like this

```
REACT_APP_ACCESS_TOKEN="eyJhbGsomethingsomethingsomething"
```

Then, `cd` to this folder (`chat`) from the root directory and run `yarn start`.

The chat interface should open in your default browser and ALmond should say "Welcome back!". Try replying with "Tell me a joke"!

## Enabling Voice

To get voice working, first go to [almond-voice](https://github.com/euirim/almond-voice) and clone the repository. Then, run `yarn start-api:dev`. By default this serves a speech-to-text endpoint at `http://127.0.0.1:8000/rest/stt`. If you change this, remember to set the new endpoint in your `.env` file here as well under the `REACT_APP_STTURL` variable, so your new `.env` file should go something like.

```
REACT_APP_ACCESS_TOKEN="eyJhbGsomethingsomethingsomething"
REACT_APP_STTURL="http://127.0.0.1:yourport/rest/stt"
```

Next, run the chat interface and click on the mic button at the bottom right to start recording. Click again to stop recording after speaking your command.