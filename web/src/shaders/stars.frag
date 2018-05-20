<script type="x-shader/x-fragment" id="stars-frag">
  uniform float radius;
  uniform float depth;
  uniform float alpha;
  varying vec3 vPosition;
  varying float distance;

  void main() {
    float a = clamp(1. - (distance / depth) / 2., 0., 1.);
    float nearDist = 700.;
    float na = 1.0 - pow(1. - min(vPosition.z, nearDist) / nearDist, 3.);
    gl_FragColor = vec4(pow(a, 3.), pow(a, 2.), a, na * alpha);
  }
</script>
