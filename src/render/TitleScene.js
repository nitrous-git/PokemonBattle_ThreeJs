import * as THREE from 'three';

// A single procedural sky pass: no textures, downloads, postprocessing or assets.
// Coordinates use viewport height so the horizon stays circular on every device.
const fragmentShader = /* glsl */ `
precision highp float;
uniform vec2 uSize;
uniform float uTime;
uniform float uDetail;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
}
float fbm(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<5;i++){ v+=a*noise(p); p=mat2(1.6,1.2,-1.2,1.6)*p+7.1; a*=0.5; }
    return v;
}
float glow(float d, float width) { return exp(-abs(d)/width); }
vec3 flare(vec2 p, vec3 tint, float strength) {
    float core=exp(-length(p)*150.0);
    float rays=exp(-abs(p.x)*12.0-abs(p.y)*300.0)+exp(-abs(p.x)*300.0-abs(p.y)*30.0);
    return tint*strength*(core+rays*0.24+exp(-length(p)*25.0)*0.12);
}
vec3 moon(vec3 sky, vec2 p, vec2 center, float radius) {
    vec2 q=(p-center)/radius; float d=length(q);
    sky+=vec3(0.05,0.25,0.55)*exp(-abs(d-1.0)*35.0)*0.5;
    if(d<1.0){
        vec3 n=vec3(q,sqrt(max(0.0,1.0-dot(q,q))));
        float terrain=fbm(q*8.0)+noise(q*48.0)*0.1;
        float light=max(0.0,dot(n,normalize(vec3(0.8,0.55,0.45))));
        vec3 rock=mix(vec3(0.018,0.034,0.07),vec3(0.14,0.25,0.39),terrain);
        sky=rock*(0.12+light*1.8)+vec3(0.09,0.4,0.7)*pow(1.0-n.z,5.0)*light;
    }
    return sky;
}
void main(){
    float aspect=uSize.x/uSize.y;
    vec2 p=(vUv-0.5)*vec2(aspect,1.0)*2.0;
    float narrow=1.0-smoothstep(0.75,1.4,aspect);
    float t=uTime;
    vec2 drift=vec2(t*0.0015,-t*0.001);
    float cloud=fbm(p*2.2+drift+8.0);
    float wisps=fbm(p*4.0+cloud*2.3+drift);
    float edge=smoothstep(0.25,1.4,abs(p.x));
    float band=exp(-pow(p.y-0.2-0.33*sin(p.x*2.0),2.0)*2.5);
    vec3 col=vec3(0.006,0.017,0.052);
    col+=vec3(0.018,0.08,0.21)*pow(cloud,2.0)*(0.6+edge)*band;
    col+=vec3(0.09,0.035,0.19)*pow(wisps,3.0)*edge;
    col+=vec3(0.0,0.025,0.065)*exp(-length(p-vec2(0,-0.35))*1.8);
    col*=0.48;
    for(int i=0;i<3;i++) {
        float layer=float(i), scale=72.0+layer*36.0;
        vec2 s=(p+drift*(layer+1.0))*scale;
        vec2 cell=floor(s), local=fract(s)-0.5;
        float h=hash(cell+layer*79.0);
        float star=exp(-dot(local,local)*(180.0-layer*40.0));
        float visible=step(0.985+layer*0.004,h);
        float twinkle=0.82+0.18*sin(t*0.4+h*60.0);
        col+=mix(vec3(0.25,0.55,1.0),vec3(0.92,0.90,0.73),h)*star*visible*twinkle*(0.5+layer*0.2);
    }
    col=moon(col,p,vec2(-aspect*0.80,0.75),mix(0.57,0.28,narrow));
    col=moon(col,p,vec2(aspect*0.66,0.57),mix(0.105,0.07,narrow));
    // Deliberately sparse streaks leave a quiet center for the wordmark.
    float left=1.0-smoothstep(-0.25,-0.02,p.x);
    float right=smoothstep(0.3,0.8,p.x);
    float arc=p.y-(-0.40-0.28*p.x+0.12*p.x*p.x);
    float warm=p.y-(-0.45+0.30*(p.x-0.45));
    col+=vec3(0.10,0.65,1.0)*(glow(arc,0.004)+glow(arc,0.035)*0.30)*left*0.7;
    col+=vec3(1.0,0.54,0.13)*(glow(warm,0.003)+glow(warm,0.028)*0.26)*right*0.8;
    float orbit=length((p-vec2(0.0,0.05))*vec2(0.65,2.6))-1.0;
    col+=vec3(0.03,0.34,0.65)*glow(orbit,0.002)*(0.2+0.2*sin(p.x*3.0+t*0.08))*edge;
    float travel=fract(t*0.035+0.37);
    float x=mix(-aspect,-0.48,travel);
    col+=flare(p-vec2(x,-0.40-0.28*x+0.12*x*x),vec3(0.25,0.75,1.0),sin(travel*3.14159)*0.6);
    col+=flare(p-vec2(aspect*0.80,0.12),vec3(0.2,0.6,1.0),0.4);
    // Analytic sphere: curved ocean, continents, clouds and atmospheric scattering.
    float radius=mix(5.3,3.4,narrow);
    vec2 q=p-vec2(0.0,-radius-0.46);
    float d=length(q)-radius;
    float sunriseX=aspect*0.43;
    float sunriseY=-radius-0.46+sqrt(max(0.0,radius*radius-sunriseX*sunriseX));
    vec2 sun=p-vec2(sunriseX,sunriseY+0.018);
    vec3 blue=vec3(0.12,0.60,1.0);
    col+=blue*(glow(d,0.016)*1.3+glow(d,0.075)*0.28+glow(d,0.19)*0.07);
    if(d<0.0){
        vec3 normal=vec3(q/radius,sqrt(max(0.0,1.0-dot(q,q)/(radius*radius))));
        vec2 terrainUV=vec2(atan(normal.x,normal.z),asin(normal.y))*vec2(4.0,7.0);
        float terrain=fbm(terrainUV*3.4+vec2(18.0,3.0));
        float ridges=noise(terrainUV*120.0);
        vec3 ocean=mix(vec3(0.006,0.055,0.14),vec3(0.015,0.25,0.43),terrain);
        vec3 land=mix(vec3(0.05,0.15,0.15),vec3(0.38,0.34,0.17),terrain+ridges*0.14);
        vec3 ground=mix(ocean,land,smoothstep(0.53,0.58,terrain));
        float clouds=fbm(terrainUV*5.2+vec2(t*0.002,32.0));
        float cover=smoothstep(0.49,0.68,clouds+noise(terrainUV*70.0)*0.07);
        ground=mix(ground,vec3(0.64,0.78,0.88),cover*0.9);
        float light=0.35+0.65*max(0.0,dot(normal,normalize(vec3(0.3,0.8,0.6))));
        col=ground*light+blue*glow(d,0.022)*1.2;
        col+=vec3(1.0,0.63,0.29)*exp(-abs(p.x-sunriseX)*6.0)*exp(d*3.0)*0.24;
        col*=mix(0.38,1.0,smoothstep(-1.0,-0.5,p.y));
        col=mix(blue*0.9,col,smoothstep(0.0,0.025,-d));
    }
    col+=vec3(1.0,0.52,0.18)*exp(-length(sun)*13.0)*0.8;
    col+=vec3(1.0,0.88,0.61)*exp(-length(sun)*75.0)*2.5;
    col+=vec3(1.0,0.72,0.32)*exp(-abs(sun.y)*170.0-abs(sun.x)*4.5)*0.65;
    // A few peripheral electric glints, never a full-screen flash.
    float pulse=pow(0.5+0.5*sin(t*0.65),12.0)*uDetail;
    col+=flare(p-vec2(-aspect*0.78,-0.32),vec3(0.18,0.66,1.0),0.4+pulse*0.25);
    // Small irregular rock silhouettes frame the horizon; fewer on portrait screens.
    for(int i=0;i<10;i++) {
        float fi=float(i);
        float side=mod(fi,2.0)*2.0-1.0;
        float seed=hash(vec2(fi,18.0));
        vec2 center=vec2(side*aspect*(0.69+0.26*seed),-0.35-seed*0.57);
        center.y+=sin(t*0.09+fi)*0.009;
        float size=(0.018+seed*seed*0.075)*(1.0-narrow*0.45);
        vec2 local=(p-center)/size;
        float angle=atan(local.y,local.x);
        float shape=length(local)*(1.0+0.10*sin(angle*3.0+fi)+0.05*cos(angle*7.0));
        if(shape<1.0 && (uDetail>0.5 || i<4)) {
            float facet=floor((angle+3.14159)*2.5)/16.0;
            col=mix(vec3(0.009,0.018,0.035),vec3(0.10,0.16,0.24),facet);
            col+=vec3(0.26,0.45,0.62)*pow(max(0.0,local.y),4.0)*smoothstep(0.7,1.0,shape)*0.5;
        }
    }
    col*=1.0-0.22*smoothstep(0.65,1.5,length(vUv-0.5)*1.8);
    gl_FragColor=vec4(col,1.0);
    #include <colorspace_fragment>
}`;

export class TitleScene {
  constructor(host, settings = {}) {
    this.host = host;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'title-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.active = false;
    this.elapsed = 0;
    this.raf = null;
    this.media = matchMedia('(prefers-reduced-motion: reduce)');
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: false,
        powerPreference: 'low-power',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
      this.camera.position.z = 1;
      this.uniforms = {
        uSize: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uDetail: { value: 1 },
      };
      this.material = new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader:
          'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
        fragmentShader,
        depthTest: false,
        depthWrite: false,
      });
      this.geometry = new THREE.PlaneGeometry(2, 2);
      this.scene.add(new THREE.Mesh(this.geometry, this.material));
      host.append(this.canvas);
      this.onVisibility = () => this.sync();
      this.onMotion = () => this.settingsChanged(this.settings);
      this.onLost = (event) => {
        event.preventDefault();
        this.lost = true;
        this.canvas.hidden = true;
        this.sync();
      };
      this.onRestored = () => {
        this.lost = false;
        this.canvas.hidden = false;
        this.resize();
        this.sync();
      };
      document.addEventListener('visibilitychange', this.onVisibility);
      this.media.addEventListener('change', this.onMotion);
      this.canvas.addEventListener('webglcontextlost', this.onLost);
      this.canvas.addEventListener('webglcontextrestored', this.onRestored);
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(host);
      this.settingsChanged(settings);
      this.setActive(true);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  settingsChanged(settings) {
    this.settings = settings;
    this.reduced = Boolean(settings.reducedMotion || this.media.matches);
    this.uniforms.uDetail.value = settings.lowVFX ? 0 : 1;
    this.resize();
    this.sync();
  }

  resize() {
    if (this.disposed || this.lost) return;
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    // Limit both DPR and total shaded pixels, including large desktop displays.
    const cap = this.settings?.lowVFX ? 900000 : 2200000;
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        this.settings?.lowVFX ? 1 : 1.5,
        Math.sqrt(cap / (width * height)),
      ),
    );
    this.renderer.setSize(width, height, false);
    this.uniforms.uSize.value.set(width, height);
    this.draw();
  }

  attach(host) {
    if (host === this.host) return;
    this.observer.unobserve(this.host);
    this.host = host;
    host.append(this.canvas);
    this.observer.observe(host);
    this.resize();
  }

  draw() {
    if (this.disposed || this.lost || !this.active || document.hidden) return;
    this.uniforms.uTime.value = this.reduced ? 0 : this.elapsed;
    this.renderer.render(this.scene, this.camera);
  }

  setActive(active) {
    this.active = active;
    this.sync();
  }

  sync() {
    cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.disposed || !this.active || this.lost || document.hidden) return;
    this.draw();
    if (this.reduced) return;
    let previous = performance.now();
    const frame = (now) => {
      // 30 FPS is sufficient for this slow scene, and avoids competing GPU work.
      if (now - previous >= 1000 / 30) {
        this.elapsed += Math.min(0.1, (now - previous) / 1000);
        previous = now;
        this.draw();
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  dispose() {
    this.disposed = true;
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.raf = null;
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.media?.removeEventListener('change', this.onMotion);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.geometry?.dispose();
    this.material?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.canvas.remove();
  }
}
