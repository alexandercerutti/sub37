# @sub37's sample

This is a sample Vite project that has the objective to show and test how the engine is integrated.

It offers two pages:

- [Native Video](http://localhost:3000/pages/native-video/index.html) page, which sets up a video tag showing the famous Big Buck Bunny video and some custom native subtitles;
- [Sub37 Example](http://localhost:3000/pages/sub37-example/index.html) page, which sets up a fake HTMLVideoElement that has seeking, playing and pausing capabilities and shows custom subtitles through the usage of `sub37` libraries. This is also used by `@sub37/captions-renderer`'s integration tests to verify everything is fine;

## Starting the server

If you are placed in this project's folder, you can run:

```sh
$ npm run dev
```

It is also possible to start the project from the monorepo root by running:

```sh
$ npm run sample:serve
```
