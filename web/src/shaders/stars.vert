<script type="x-shader/x-vertex" id="stars-vert">
  uniform float time;
  uniform float radius;
  uniform float depth;
  uniform float alpha;
  uniform float pointSize;
  uniform float speed;

  varying vec3 vPosition;
  varying float distance;

  void main() {
    vPosition = position;
    distance = length(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 projPosition = projectionMatrix * mvPosition;
    gl_PointSize = (1. - (distance / depth * 0.9)) * pointSize;
    gl_Position = projPosition;
  }
</script>
