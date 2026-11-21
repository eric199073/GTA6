// Keep previously saved detail links pointing at the integrated map and guide.
document.addEventListener('DOMContentLoaded', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (window.GTA6_MARKERS.markers.some(marker => marker.id === id)) {
    location.replace('index.html#' + encodeURIComponent(id));
  }
});
