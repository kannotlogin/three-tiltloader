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

// Brush-specific shader for GlTF web preview, based on EmissiveAlpha generator.

precision mediump float;

out vec4 fragColor;

uniform sampler2D u_MainTex;
uniform vec4 u_time;
uniform float u_EmissionGain;
in vec4 v_color;
in vec2 v_texcoord0;

uniform float u_AudioVolume;
uniform vec4 u_BeatFFT;

vec4 GetRainbowColor( vec2 texcoord)
{
	vec4 _Time = u_time;
	texcoord = clamp(texcoord, 0.0, 1.0);
	// Create parametric UV's
	vec2 uvs = texcoord;
	float row_id = floor(uvs.y * 5.0);
	uvs.y *= 5.0;
				 
	// Create parametric colors
	vec4 tex = vec4(0.0,0.0,0.0,1.0);
		
	float row_y = mod(uvs.y,1.0); 

	
	row_id = ceil(mod(row_id + _Time.z,5.0)) - 1.0;
	
	tex.rgb = row_id == 0.0 ? vec3(1.0,0.0,0.0) : tex.rgb;
	tex.rgb = row_id == 1.0 ? vec3(.7,.3,0.0) : tex.rgb;
	tex.rgb = row_id == 2.0 ? vec3(0.0,1.0,.0) : tex.rgb;
	tex.rgb = row_id == 3.0 ? vec3(0.0,.2,1.0) : tex.rgb;
	tex.rgb = row_id == 4.0 ? vec3(.4,0.0,1.2) : tex.rgb;
	
	// Make rainbow lines pulse
	tex.rgb *= pow( (sin(row_id * 1.0 + _Time.z)   + 1.0)/2.0,5.0);

	// Make rainbow lines thin
	tex.rgb *= clamp(pow(row_y * (1.0 - row_y) * 5.0, 50.0), 0.0, 1.0);  


	return tex;
}

vec4 GetAudioReactiveRainbowColor( vec2 texcoord, float beatAccumX )
{
	texcoord = clamp(texcoord, 0.0, 1.0);
	vec2 uvs = texcoord;
	float row_id = floor(uvs.y * 5.0);
	uvs.y *= 5.0;

	vec4 tex = vec4(0.0,0.0,0.0,1.0);
	float row_y = mod(uvs.y, 1.0);

	row_id = ceil(mod(row_id + beatAccumX * 3.0, 5.0)) - 1.0;

	tex.rgb = row_id == 0.0 ? vec3(1.0,0.0,0.0) : tex.rgb;
	tex.rgb = row_id == 1.0 ? vec3(0.7,0.3,0.0) : tex.rgb;
	tex.rgb = row_id == 2.0 ? vec3(0.0,1.0,0.0) : tex.rgb;
	tex.rgb = row_id == 3.0 ? vec3(0.0,0.2,1.0) : tex.rgb;
	tex.rgb = row_id == 4.0 ? vec3(0.4,0.0,1.2) : tex.rgb;

	tex.rgb *= clamp(pow(row_y * (1.0 - row_y) * 5.0, 50.0), 0.0, 1.0);
	return tex;
}

vec4 GetAudioReactiveColor( vec2 texcoord, float beatAccumZ, float beatY )
{
	texcoord = texcoord.yx;
	texcoord.y *= 2.0;

	float quantizedMotion = ceil((beatAccumZ * 0.1) / 10.0);
	float row_id = abs(texcoord.y * 12.0 + quantizedMotion);
	
	vec4 tex = vec4(0.0,0.0,0.0,1.0);
	float row_y = mod(abs(row_id), 1.0);

	row_id = ceil(mod(row_id, 8.0));

	float bandlevels = 0.0;
	if (row_id < 2.0) bandlevels = u_BeatFFT.x;
	else if (row_id < 4.0) bandlevels = u_BeatFFT.y;
	else if (row_id < 6.0) bandlevels = u_BeatFFT.z;
	else bandlevels = u_BeatFFT.w;

	bandlevels = max(bandlevels, 0.1);
	tex.rgb = abs(texcoord.x - 0.5) < bandlevels * 0.5 ? vec3(1.0,1.0,1.0) : tex.rgb;

	tex.rgb *= tex.rgb * 0.5 + tex.rgb * beatY;
	tex.rgb *= clamp(20.0 - abs(row_y - 0.5) * 50.0, 0.0, 1.0);
	return tex;
}

void main() { 
  vec4 color = v_color;
  color.a = 1.0;

  float audioActive = step(0.001, u_AudioVolume);

  vec4 texDefault = GetRainbowColor(v_texcoord0.xy);
  texDefault = color * texDefault * exp(u_EmissionGain * 3.0);

  float beatAccumX = u_time.y + u_BeatFFT.x;
  float beatAccumZ = u_time.y + u_BeatFFT.z;
  
  vec4 texAudioColor = GetAudioReactiveRainbowColor(v_texcoord0.xy, beatAccumX);
  texAudioColor *= GetAudioReactiveColor(v_texcoord0.xy, beatAccumZ, u_BeatFFT.y);
  vec4 texAudio = color * texAudioColor * exp(u_EmissionGain * 2.5);
  
  vec4 finalTex = mix(texDefault, texAudio, audioActive);
  
  fragColor = finalTex * finalTex.a;
}