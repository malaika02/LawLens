self.onmessage = ({data}) => {
  try { self.postMessage({result:globalThis.analyze(data.posts,data.comments)}); }
  catch (e) { self.postMessage({error:e.message}); }
};
