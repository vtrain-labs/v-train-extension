fetch('https://www.bilibili.com/video/BV1Yp421o7NB/').then(r => r.text()).then(t => {
    const match = t.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    console.log(match ? match[1] : 'No og:image');
});
