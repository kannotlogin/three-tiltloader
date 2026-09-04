// Copyright 2020 The Tilt Brush Authors
// Updated to OpenGL ES 3.0 by the Icosa Gallery Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

precision mediump float;

out vec4 fragColor;

in vec4 v_color;
in vec3 v_normal;
in vec3 v_position;
in vec3 v_light_dir_0;
in vec3 v_light_dir_1;
in vec2 v_texcoord0;
in float f_fog_coord;

uniform mediump float u_isOutline;

void main() {
  vec4 color = v_color;
  color.xyz += normalize(v_normal).y * 0.2;
  color.xyz = max(vec3(0.0, 0.0, 0.0), color.xyz);

  vec3 finalColor = mix(color.xyz, vec3(0.0, 0.0, 0.0), step(0.5, u_isOutline));

  fragColor.rgb = ApplyFog(finalColor, f_fog_coord);
  fragColor.a = 1.0;
}