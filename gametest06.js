"use strict";

const canvas=document.getElementById("gameCanvas");
const ctx=canvas.getContext("2d");
const W=canvas.width;
const H=canvas.height;

const ui={
    startScreen:document.getElementById("startScreen"),
    pauseScreen:document.getElementById("pauseScreen"),
    upgradeScreen:document.getElementById("upgradeScreen"),
    gameOverScreen:document.getElementById("gameOverScreen"),
    settingsScreen:document.getElementById("settingsScreen"),
    startButton:document.getElementById("startButton"),
    resumeButton:document.getElementById("resumeButton"),
    restartButton:document.getElementById("restartButton"),
    settingsButton:document.getElementById("settingsButton"),
    closeSettingsButton:document.getElementById("closeSettingsButton"),
    resetKeysButton:document.getElementById("resetKeysButton"),
    keyBindings:document.getElementById("keyBindings"),
    controlList:document.getElementById("controlList"),
    pauseButton:document.getElementById("pauseButton"),
    soundButton:document.getElementById("soundButton"),
    upgradeChoices:document.getElementById("upgradeChoices"),
    finalStats:document.getElementById("finalStats"),
    waveLabel:document.getElementById("waveLabel"),
    enemyLabel:document.getElementById("enemyLabel"),
    bossLabel:document.getElementById("bossLabel")
};

const TAU=Math.PI*2;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const random=(min,max)=>Math.random()*(max-min)+min;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleTo=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const lerp=(a,b,t)=>a+(b-a)*t;

function circlesTouch(a,b){
    return distance(a,b)<a.radius+b.radius;
}

function choose(list){
    return list[Math.floor(Math.random()*list.length)];
}

function shuffle(list){
    const result=[...list];
    for(let i=result.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [result[i],result[j]]=[result[j],result[i]];
    }
    return result;
}

const DEFAULT_KEY_BINDINGS={
    moveUp:"w",
    moveDown:"s",
    moveLeft:"a",
    moveRight:"d",
    reload:"r",
    weapon1:"1",
    weapon2:"2",
    weapon3:"3",
    weapon4:"4",
    weapon5:"5",
    grenade:"g",
    shield:"t",
    dash:"shift",
    pause:"escape"
};

const KEY_BINDING_LABELS={
    moveUp:"Di chuyển lên",
    moveDown:"Di chuyển xuống",
    moveLeft:"Di chuyển trái",
    moveRight:"Di chuyển phải",
    reload:"Nạp đạn",
    weapon1:"Súng 1: Pistol",
    weapon2:"Súng 2: Shotgun",
    weapon3:"Súng 3: Laser Gun",
    weapon4:"Súng 4: Machine Gun",
    weapon5:"Súng 5: Plasma Rifle",
    grenade:"Ném Grenade",
    shield:"Bật Shield",
    dash:"Dash",
    pause:"Tạm dừng"
};

const KEY_BINDINGS_STORAGE="zombie-shooter-key-bindings";

function normalizeKey(key){
    return key.toLowerCase()===" "?"space":key.toLowerCase();
}

function displayKey(key){
    const names={
        escape:"Esc",
        space:"Space",
        arrowup:"Mũi tên lên",
        arrowdown:"Mũi tên xuống",
        arrowleft:"Mũi tên trái",
        arrowright:"Mũi tên phải"
    };
    return names[key]||key.toUpperCase();
}

const SOUND_EFFECTS={
    pistol:"./sound/pistol.mp3",
    shotgun:"./sound/shotgun.mp3",
    laser:"./sound/laser.mp3",
    machine:"./sound/machine-gun.mp3",
    plasma:"./sound/plasma.mp3",
    hit:"./sound/hit.mp3",
    enemyDeath:"./sound/zombie-death.mp3",
    pickup:"./sound/pickup.mp3",
    reload:"./sound/reload.mp3",
    explosion:"./sound/explosion.mp3",
    dash:"./sound/dash.mp3",
    shield:"./sound/shield.mp3",
    shieldReflect:"./sound/shield-reflect.mp3",
    playerHit:"./sound/player-hit.mp3",
    boss:"./sound/boss.mp3",
    bossWarning:"./sound/boss-warning.mp3",
    bossShot:"./sound/boss-shot.mp3"
};

const SOUND_POOL_SIZES={
    machine:16,
    hit:12,
    pistol:8,
    laser:8,
    plasma:6,
    shotgun:5,
    bossShot:6,
    shieldReflect:6,
    enemyDeath:6,
    playerHit:4,
    reload:4,
    default:3
};

const SOUND_START_OFFSETS={
    pistol:.14,
    shotgun:.04,
    plasma:.095
};

class SoundSystem{
    constructor(){
        this.enabled=true;
        this.context=null;
        this.effects=new Map();
        this.poolIndexes=new Map();
        this.effectVolume=.72;
        this.synthVolume=.38;
        this.prepareEffects();
    }

    prepareEffects(){
        Object.entries(SOUND_EFFECTS).forEach(([name,path])=>{
            const size=SOUND_POOL_SIZES[name]||SOUND_POOL_SIZES.default;
            const pool=[];
            for(let i=0;i<size;i++){
                const audio=new Audio(path);
                audio.preload="auto";
                audio.volume=this.effectVolume;
                audio.addEventListener("loadedmetadata",()=>{
                    audio.currentTime=SOUND_START_OFFSETS[name]||0;
                },{once:true});
                audio.load();
                pool.push(audio);
            }
            this.effects.set(name,pool);
            this.poolIndexes.set(name,0);
        });
    }

    unlock(){
        if(!this.context){
            const AudioContext=window.AudioContext||window.webkitAudioContext;
            if(AudioContext){
                this.context=new AudioContext();
            }
        }
        if(this.context?.state==="suspended"){
            this.context.resume();
        }
    }

    tone(frequency=440,duration=.05,type="sine",volume=.025,slide=0){
        if(!this.enabled){
            return;
        }
        this.unlock();
        if(!this.context){
            return;
        }
        const now=this.context.currentTime;
        const oscillator=this.context.createOscillator();
        const gain=this.context.createGain();
        oscillator.type=type;
        oscillator.frequency.setValueAtTime(frequency,now);
        oscillator.frequency.linearRampToValueAtTime(Math.max(40,frequency+slide),now+duration);
        gain.gain.setValueAtTime(volume*this.synthVolume,now);
        gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        oscillator.start(now);
        oscillator.stop(now+duration);
    }

    effect(name,volume=1,rate=1){
        if(!this.enabled){
            return;
        }
        const pool=this.effects.get(name);
        if(!pool?.length){
            return;
        }
        let index=pool.findIndex(audio=>audio.paused||audio.ended);
        if(index<0){
            index=this.poolIndexes.get(name)||0;
        }
        const audio=pool[index];
        this.poolIndexes.set(name,(index+1)%pool.length);
        audio.pause();
        if(audio.readyState>0){
            audio.currentTime=SOUND_START_OFFSETS[name]||0;
        }else{
            audio.load();
        }
        audio.volume=clamp(this.effectVolume*volume,0,1);
        audio.playbackRate=clamp(rate,.6,1.6);
        audio.play().catch(()=>{});
    }

    shoot(type){
        const sounds={
            pistol:[220,.045,"square",.025,-60],
            shotgun:[100,.11,"sawtooth",.05,-45],
            laser:[620,.07,"sine",.035,240],
            machine:[170,.035,"square",.018,-40],
            plasma:[360,.1,"triangle",.04,260]
        };
        this.effect(type,type==="machine"?.62:1,random(.96,1.04));
        this.tone(...sounds[type]);
    }

    hit(){
        this.effect("hit",.42,random(.94,1.08));
        this.tone(110,.025,"square",.012,30);
    }

    enemyDeath(){
        this.effect("enemyDeath",.62,random(.92,1.08));
        this.tone(82,.055,"triangle",.014,-24);
    }

    pickup(){
        this.effect("pickup",.8);
        this.tone(520,.08,"sine",.03,260);
    }

    reload(){
        this.effect("reload",.7,random(.97,1.03));
        this.tone(280,.05,"triangle",.018,100);
    }

    explosion(){
        this.effect("explosion",1,random(.94,1.03));
        this.tone(75,.2,"sawtooth",.06,-30);
    }

    boss(){
        this.effect("boss",1);
        this.tone(95,.5,"sawtooth",.05,40);
    }

    dash(){
        this.effect("dash",.85);
        this.tone(180,.12,"sine",.035,300);
    }

    shield(){
        this.effect("shield",.85);
        this.tone(420,.2,"sine",.035,320);
    }

    shieldReflect(){
        this.effect("shieldReflect",.75,random(.97,1.04));
        this.tone(680,.07,"sine",.025,180);
    }

    bossWarning(){
        this.effect("bossWarning",.82);
        this.tone(210,.32,"sawtooth",.035,90);
    }

    bossShot(){
        this.effect("bossShot",.78,random(.97,1.03));
        this.tone(150,.09,"square",.025,-40);
    }

    playerHit(){
        this.effect("playerHit",.75,random(.95,1.04));
        this.tone(100,.16,"sawtooth",.045,-30);
    }
}

class Input{
    constructor(){
        this.keys=new Set();
        this.pressed=new Set();
        this.mouse={x:W/2,y:H/2,down:false,rightPressed:false};
        this.bindings=this.loadBindings();
        this.rebinding=null;
        this.bind();
    }

    bind(){
        window.addEventListener("keydown",event=>{
            const key=normalizeKey(event.key);
            if(this.rebinding){
                const action=this.rebinding.action;
                if(key!=="escape"){
                    this.setBinding(action,key);
                    this.rebinding.callback(key);
                }else{
                    this.rebinding.callback(null);
                }
                this.rebinding=null;
                event.preventDefault();
                return;
            }
            if(!this.keys.has(key)){
                this.pressed.add(key);
            }
            this.keys.add(key);
            if(["space","arrowup","arrowdown","arrowleft","arrowright"].includes(key)){
                event.preventDefault();
            }
        });
        window.addEventListener("keyup",event=>{
            this.keys.delete(normalizeKey(event.key));
        });
        canvas.addEventListener("mousemove",event=>{
            const rect=canvas.getBoundingClientRect();
            this.mouse.x=(event.clientX-rect.left)*(W/rect.width);
            this.mouse.y=(event.clientY-rect.top)*(H/rect.height);
        });
        canvas.addEventListener("mousedown",event=>{
            if(event.button===0){
                this.mouse.down=true;
            }
            if(event.button===2){
                this.mouse.rightPressed=true;
                event.preventDefault();
            }
        });
        window.addEventListener("mouseup",event=>{
            if(event.button===0){
                this.mouse.down=false;
            }
        });
        canvas.addEventListener("contextmenu",event=>event.preventDefault());
        window.addEventListener("blur",()=>{
            this.keys.clear();
            this.mouse.down=false;
            this.mouse.rightPressed=false;
            if(game.state==="playing"){
                game.pause();
            }
        });
    }

    isDown(...keys){
        return keys.some(key=>this.keys.has(key));
    }

    isActionDown(action){
        return this.isDown(this.bindings[action]);
    }

    consumeAction(action){
        return this.consume(this.bindings[action]);
    }

    isActionKey(action,key){
        return this.bindings[action]===normalizeKey(key);
    }

    loadBindings(){
        try{
            const saved=JSON.parse(localStorage.getItem(KEY_BINDINGS_STORAGE)||"{}");
            return Object.fromEntries(Object.keys(DEFAULT_KEY_BINDINGS).map(action=>[
                action,
                typeof saved[action]==="string"&&saved[action]?normalizeKey(saved[action]):DEFAULT_KEY_BINDINGS[action]
            ]));
        }catch(error){
            return {...DEFAULT_KEY_BINDINGS};
        }
    }

    saveBindings(){
        localStorage.setItem(KEY_BINDINGS_STORAGE,JSON.stringify(this.bindings));
    }

    setBinding(action,key){
        const conflictingAction=Object.keys(this.bindings).find(item=>item!==action&&this.bindings[item]===key);
        if(conflictingAction){
            this.bindings[conflictingAction]=this.bindings[action];
        }
        this.bindings[action]=key;
        this.saveBindings();
    }

    beginRebind(action,callback){
        this.rebinding={action,callback};
    }

    resetBindings(){
        this.bindings={...DEFAULT_KEY_BINDINGS};
        this.saveBindings();
    }

    consume(key){
        if(this.pressed.has(key)){
            this.pressed.delete(key);
            return true;
        }
        return false;
    }

    consumeRightClick(){
        if(!this.mouse.rightPressed){
            return false;
        }
        this.mouse.rightPressed=false;
        return true;
    }

    endFrame(){
        this.pressed.clear();
        this.mouse.rightPressed=false;
    }
}

const WEAPONS=[
    {
        id:"pistol",
        name:"Pistol",
        short:"PST",
        damage:24,
        fireDelay:.24,
        speed:760,
        spread:.018,
        pellets:1,
        magazineSize:12,
        reserve:84,
        maxReserve:180,
        reload:1,
        color:"#ffd166",
        radius:3.2,
        pierce:0,
        knockback:55
    },
    {
        id:"shotgun",
        name:"Shotgun",
        short:"SG",
        damage:12,
        fireDelay:.72,
        speed:680,
        spread:.17,
        pellets:7,
        magazineSize:6,
        reserve:36,
        maxReserve:90,
        reload:.48,
        shellReload:true,
        color:"#ff9f43",
        radius:3,
        pierce:0,
        knockback:85
    },
    {
        id:"laser",
        name:"Laser Gun",
        short:"LSR",
        damage:19,
        fireDelay:.13,
        speed:1040,
        spread:.006,
        pellets:1,
        magazineSize:20,
        reserve:100,
        maxReserve:240,
        reload:1.25,
        color:"#4de8ff",
        radius:3.3,
        pierce:1,
        knockback:30
    },
    {
        id:"machine",
        name:"Machine Gun",
        short:"MG",
        damage:13,
        fireDelay:.075,
        speed:850,
        spread:.065,
        pellets:1,
        magazineSize:36,
        reserve:180,
        maxReserve:360,
        reload:1.7,
        color:"#ff5e6c",
        radius:2.8,
        pierce:0,
        knockback:28
    },
    {
        id:"plasma",
        name:"Plasma Rifle",
        short:"PLS",
        damage:43,
        fireDelay:.42,
        speed:610,
        spread:.025,
        pellets:1,
        magazineSize:10,
        reserve:50,
        maxReserve:120,
        reload:1.55,
        color:"#b77cff",
        radius:6,
        pierce:2,
        knockback:95,
        splash:42
    }
];

class WeaponSystem{
    constructor(owner){
        this.owner=owner;
        this.selected=0;
        this.cooldown=0;
        this.reloadTimer=0;
        this.reloading=false;
        this.ammo=WEAPONS.map(weapon=>({
            magazine:weapon.magazineSize,
            reserve:weapon.reserve
        }));
    }

    get definition(){
        return WEAPONS[this.selected];
    }

    get currentAmmo(){
        return this.ammo[this.selected];
    }

    reset(){
        this.selected=0;
        this.cooldown=0;
        this.reloadTimer=0;
        this.reloading=false;
        this.ammo=WEAPONS.map(weapon=>({
            magazine:weapon.magazineSize,
            reserve:weapon.reserve
        }));
    }

    select(index){
        if(index<0||index>=WEAPONS.length||index===this.selected){
            return;
        }
        this.cancelReload();
        this.selected=index;
        game.notify(WEAPONS[index].name,WEAPONS[index].color);
    }

    cancelReload(){
        this.reloading=false;
        this.reloadTimer=0;
    }

    canReload(){
        const weapon=this.definition;
        const ammo=this.currentAmmo;
        return !this.reloading&&ammo.magazine<weapon.magazineSize&&ammo.reserve>0;
    }

    beginReload(){
        if(!this.canReload()){
            return;
        }
        this.reloading=true;
        this.reloadTimer=this.definition.reload*this.owner.reloadMultiplier;
        sound.reload();
    }

    finishReload(){
        const weapon=this.definition;
        const ammo=this.currentAmmo;
        if(weapon.shellReload){
            if(ammo.reserve>0&&ammo.magazine<weapon.magazineSize){
                ammo.magazine++;
                ammo.reserve--;
                sound.reload();
            }
            if(ammo.magazine<weapon.magazineSize&&ammo.reserve>0){
                this.reloadTimer=weapon.reload*this.owner.reloadMultiplier;
            }else{
                this.cancelReload();
            }
            return;
        }
        const amount=Math.min(weapon.magazineSize-ammo.magazine,ammo.reserve);
        ammo.magazine+=amount;
        ammo.reserve-=amount;
        this.cancelReload();
    }

    update(dt){
        this.cooldown=Math.max(0,this.cooldown-dt);
        if(this.reloading){
            this.reloadTimer-=dt;
            if(this.reloadTimer<=0){
                this.finishReload();
            }
        }
        if(input.consumeAction("reload")){
            this.beginReload();
        }
        for(let i=0;i<WEAPONS.length;i++){
            if(input.consumeAction(`weapon${i+1}`)){
                this.select(i);
            }
        }
        if(input.mouse.down){
            this.fire();
        }
    }

    fire(){
        const weapon=this.definition;
        const ammo=this.currentAmmo;
        if(this.cooldown>0){
            return;
        }
        if(this.reloading){
            if(weapon.shellReload&&ammo.magazine>0){
                this.cancelReload();
            }else{
                return;
            }
        }
        if(ammo.magazine<=0){
            this.beginReload();
            if(ammo.reserve<=0){
                game.notify("HẾT ĐẠN",game.colors.danger);
                this.cooldown=.25;
            }
            return;
        }
        ammo.magazine--;
        this.cooldown=weapon.fireDelay*this.owner.fireRateMultiplier;
        const baseAngle=angleTo(this.owner,input.mouse);
        for(let i=0;i<weapon.pellets;i++){
            const spread=random(-weapon.spread,weapon.spread);
            const angle=baseAngle+spread;
            game.bullets.push(new Bullet(
                this.owner.x+Math.cos(angle)*this.owner.radius,
                this.owner.y+Math.sin(angle)*this.owner.radius,
                angle,
                weapon,
                this.owner
            ));
        }
        this.owner.recoil=Math.min(6,this.owner.recoil+weapon.knockback*.02);
        game.shake=Math.min(8,game.shake+(weapon.id==="shotgun"?4:weapon.id==="plasma"?3:.7));
        game.spawnMuzzle(this.owner.x,this.owner.y,baseAngle,weapon.color);
        sound.shoot(weapon.id);
        if(ammo.magazine===0&&ammo.reserve>0){
            this.beginReload();
        }
    }

    addSupplies(){
        let changed=false;
        this.ammo.forEach((ammo,index)=>{
            const weapon=WEAPONS[index];
            const amount=Math.max(weapon.magazineSize,Math.round(weapon.reserve*.22));
            const before=ammo.reserve;
            ammo.reserve=Math.min(weapon.maxReserve,ammo.reserve+amount);
            if(ammo.reserve>before){
                changed=true;
            }
        });
        return changed;
    }
}

class Player{
    constructor(){
        this.radius=15;
        this.weapons=new WeaponSystem(this);
        this.reset();
    }

    reset(){
        this.x=W/2;
        this.y=H/2;
        this.maxHp=100;
        this.hp=100;
        this.speed=235;
        this.damageMultiplier=1;
        this.fireRateMultiplier=1;
        this.reloadMultiplier=1;
        this.extraPierce=0;
        this.critChance=.08;
        this.critMultiplier=1.75;
        this.lifeSteal=0;
        this.invulnerable=0;
        this.recoil=0;
        this.dashCooldown=0;
        this.dashCooldownMax=2.2;
        this.dashTime=0;
        this.dashDirection={x:0,y:0};
        this.shield=0;
        this.shieldCooldown=0;
        this.shieldDuration=1.8;
        this.shieldCooldownMax=9;
        this.grenades=4;
        this.maxGrenades=10;
        this.weapons.reset();
    }

    update(dt){
        this.invulnerable=Math.max(0,this.invulnerable-dt);
        this.dashCooldown=Math.max(0,this.dashCooldown-dt);
        this.shieldCooldown=Math.max(0,this.shieldCooldown-dt);
        this.shield=Math.max(0,this.shield-dt);
        this.recoil=lerp(this.recoil,0,Math.min(1,dt*15));

        let dx=(input.isActionDown("moveRight")?1:0)-(input.isActionDown("moveLeft")?1:0);
        let dy=(input.isActionDown("moveDown")?1:0)-(input.isActionDown("moveUp")?1:0);
        const length=Math.hypot(dx,dy)||1;
        dx/=length;
        dy/=length;

        if((input.consumeRightClick()||input.consumeAction("dash"))&&this.dashCooldown<=0&&(dx||dy)){
            this.dashTime=.16;
            this.dashCooldown=this.dashCooldownMax;
            this.dashDirection={x:dx,y:dy};
            this.invulnerable=Math.max(this.invulnerable,.2);
            game.spawnBurst(this.x,this.y,"#57dcff",12,160);
            sound.dash();
        }

        if(input.consumeAction("shield")&&this.shieldCooldown<=0){
            this.shield=this.shieldDuration;
            this.shieldCooldown=this.shieldCooldownMax;
            game.spawnBurst(this.x,this.y,"#64e7ff",18,110);
            sound.shield();
        }

        if(input.consumeAction("grenade")){
            game.throwGrenade();
        }

        if(this.dashTime>0){
            this.dashTime-=dt;
            this.x+=this.dashDirection.x*670*dt;
            this.y+=this.dashDirection.y*670*dt;
            if(Math.random()<.75){
                game.particles.push(new Particle(this.x,this.y,"#54d8ff",random(2,5),.3,random(-40,40),random(-40,40)));
            }
        }else{
            this.x+=dx*this.speed*dt;
            this.y+=dy*this.speed*dt;
        }
        this.x=clamp(this.x,this.radius+7,W-this.radius-7);
        this.y=clamp(this.y,this.radius+7,H-this.radius-7);
        this.weapons.update(dt);
    }

    takeDamage(amount){
        if(this.invulnerable>0||this.shield>0||game.state!=="playing"){
            return;
        }
        this.hp-=amount;
        this.invulnerable=.48;
        game.combo=0;
        game.shake=Math.min(13,game.shake+7);
        game.flash=.16;
        game.spawnBurst(this.x,this.y,"#ff5e6c",10,130);
        sound.playerHit();
        if(this.hp<=0){
            this.hp=0;
            game.endGame();
        }
    }

    heal(amount){
        const before=this.hp;
        this.hp=Math.min(this.maxHp,this.hp+amount);
        return this.hp>before;
    }

    draw(){
        const aim=angleTo(this,input.mouse);
        ctx.save();
        ctx.translate(this.x,this.y);
        if(this.invulnerable>0&&Math.floor(this.invulnerable*18)%2===0){
            ctx.globalAlpha=.45;
        }
        ctx.rotate(aim);
        ctx.fillStyle="#182f3a";
        ctx.fillRect(5,-5,25-this.recoil,10);
        ctx.fillStyle=this.weapons.definition.color;
        ctx.fillRect(15-this.recoil,-3,20,6);
        ctx.restore();

        ctx.save();
        ctx.translate(this.x,this.y);
        const gradient=ctx.createRadialGradient(-4,-5,2,0,0,this.radius);
        gradient.addColorStop(0,"#dffaff");
        gradient.addColorStop(.22,"#67d6e7");
        gradient.addColorStop(1,"#176478");
        ctx.fillStyle=gradient;
        ctx.beginPath();
        ctx.arc(0,0,this.radius,0,TAU);
        ctx.fill();
        ctx.strokeStyle="#b9f5ff";
        ctx.lineWidth=2;
        ctx.stroke();
        ctx.fillStyle="#0a1d25";
        ctx.beginPath();
        ctx.arc(Math.cos(aim)*6,Math.sin(aim)*6,3,0,TAU);
        ctx.fill();
        ctx.restore();

        if(this.shield>0){
            const pulse=2+Math.sin(game.time*9)*2;
            ctx.save();
            ctx.strokeStyle=`rgba(93,226,255,${.55+Math.sin(game.time*8)*.18})`;
            ctx.lineWidth=3;
            ctx.shadowBlur=18;
            ctx.shadowColor="#55dfff";
            ctx.beginPath();
            ctx.arc(this.x,this.y,28+pulse,0,TAU);
            ctx.stroke();
            ctx.restore();
        }
    }
}

class Bullet{
    constructor(x,y,angle,weapon,owner){
        this.x=x;
        this.y=y;
        this.radius=weapon.radius;
        this.vx=Math.cos(angle)*weapon.speed;
        this.vy=Math.sin(angle)*weapon.speed;
        this.damage=weapon.damage*owner.damageMultiplier;
        this.color=weapon.color;
        this.life=1.35;
        this.pierce=weapon.pierce+owner.extraPierce;
        this.knockback=weapon.knockback;
        this.splash=weapon.splash||0;
        this.critChance=owner.critChance;
        this.critMultiplier=owner.critMultiplier;
        this.hit=new Set();
    }

    update(dt){
        this.x+=this.vx*dt;
        this.y+=this.vy*dt;
        this.life-=dt;
    }

    draw(){
        ctx.save();
        ctx.strokeStyle=this.color;
        ctx.lineWidth=this.radius*1.25;
        ctx.lineCap="round";
        ctx.shadowBlur=12;
        ctx.shadowColor=this.color;
        ctx.beginPath();
        ctx.moveTo(this.x-this.vx*.016,this.y-this.vy*.016);
        ctx.lineTo(this.x,this.y);
        ctx.stroke();
        ctx.restore();
    }
}

const ENEMY_TYPES={
    walker:{name:"Walker",radius:14,hp:12,speed:68,damage:10,score:10,color:"#78c96b"},
    runner:{name:"Runner",radius:11,hp:12,speed:128,damage:8,score:14,color:"#e8c859"},
    tank:{name:"Tank",radius:22,hp:43,speed:45,damage:18,score:24,color:"#698a5b"},
    spitter:{name:"Spitter",radius:14,hp:25,speed:60,damage:9,score:20,color:"#6fd2a0",ranged:true},
    exploder:{name:"Exploder",radius:13,hp:25,speed:82,damage:22,score:23,color:"#ee8b4d",exploder:true}
};

class Enemy{
    constructor(type,wave,position=null){
        const data=ENEMY_TYPES[type];
        const spawn=position||game.edgeSpawn();
        this.type=type;
        this.name=data.name;
        this.x=spawn.x;
        this.y=spawn.y;
        this.radius=data.radius;
        this.maxHp=data.hp;
        this.hp=this.maxHp;
        this.speed=data.speed*(1+Math.min(.45,wave*.012));
        this.damage=data.damage*(1+Math.min(.65,wave*.025));
        this.score=data.score;
        this.color=data.color;
        this.ranged=Boolean(data.ranged);
        this.exploder=Boolean(data.exploder);
        this.attackCooldown=random(.1,.6);
        this.shootCooldown=random(1.4,2.2);
        this.flash=0;
        this.dead=false;
        this.vx=0;
        this.vy=0;
    }

    update(dt){
        const player=game.player;
        this.flash=Math.max(0,this.flash-dt);
        this.attackCooldown=Math.max(0,this.attackCooldown-dt);
        this.shootCooldown=Math.max(0,this.shootCooldown-dt);
        const angle=angleTo(this,player);
        const playerDistance=distance(this,player);
        let move=1;

        if(this.ranged){
            if(playerDistance<170){
                move=-.6;
            }else if(playerDistance<270){
                move=0;
            }
            if(this.shootCooldown<=0&&playerDistance<390){
                this.shootCooldown=random(1.65,2.3);
                game.enemyBullets.push(new EnemyBullet(this.x,this.y,angle,230,this.damage*.72,"#8effb0",4));
            }
        }

        if(this.exploder&&playerDistance<62){
            this.explode();
            return;
        }

        this.vx=lerp(this.vx,Math.cos(angle)*this.speed*move,Math.min(1,dt*5));
        this.vy=lerp(this.vy,Math.sin(angle)*this.speed*move,Math.min(1,dt*5));
        this.x+=this.vx*dt;
        this.y+=this.vy*dt;

        if(circlesTouch(this,player)&&this.attackCooldown<=0){
            this.attackCooldown=.7;
            player.takeDamage(this.damage);
            const push=angleTo(player,this);
            this.x+=Math.cos(push)*18;
            this.y+=Math.sin(push)*18;
        }
    }

    explode(){
        this.dead=true;
        game.spawnBurst(this.x,this.y,"#ff9b4a",22,230);
        game.shake=Math.min(12,game.shake+6);
        if(distance(this,game.player)<100){
            game.player.takeDamage(this.damage);
        }
        sound.explosion();
    }

    takeDamage(amount,bullet,critical=false){
        this.hp-=amount;
        this.flash=.08;
        const velocity=Math.hypot(bullet.vx,bullet.vy)||1;
        this.x+=bullet.vx/velocity*bullet.knockback*.09;
        this.y+=bullet.vy/velocity*bullet.knockback*.09;
        game.damageTexts.push(new DamageText(this.x,this.y,Math.round(amount),critical));
        game.spawnBurst(this.x,this.y,critical?"#ffe66d":this.color,critical?6:3,90);
        if(this.hp<=0){
            this.die();
        }
    }

    die(){
        if(this.dead){
            return;
        }
        this.dead=true;
        game.registerKill(this.score,this.x,this.y);
        game.spawnBurst(this.x,this.y,this.color,14,170);
        sound.enemyDeath();
        if(Math.random()<.075){
            game.pickups.push(new Pickup(this.x,this.y,Math.random()<.72?"supply":"health"));
        }
    }

    draw(){
        ctx.save();
        ctx.translate(this.x,this.y);
        const angle=angleTo(this,game.player);
        ctx.rotate(angle);
        ctx.fillStyle=this.flash>0?"#ffffff":this.color;
        ctx.shadowBlur=this.flash>0?15:0;
        ctx.shadowColor="#fff";
        ctx.beginPath();
        ctx.arc(0,0,this.radius,0,TAU);
        ctx.fill();
        ctx.fillStyle="rgba(7,20,16,.8)";
        ctx.beginPath();
        ctx.arc(this.radius*.35,-this.radius*.28,2.4,0,TAU);
        ctx.arc(this.radius*.35,this.radius*.28,2.4,0,TAU);
        ctx.fill();
        if(this.type==="tank"){
            ctx.strokeStyle="#a8bd81";
            ctx.lineWidth=4;
            ctx.beginPath();
            ctx.arc(0,0,this.radius-3,-1.2,1.2);
            ctx.stroke();
        }
        if(this.type==="exploder"){
            ctx.strokeStyle=`rgba(255,210,90,${.45+Math.sin(game.time*12)*.35})`;
            ctx.lineWidth=2;
            ctx.beginPath();
            ctx.arc(0,0,this.radius+4,0,TAU);
            ctx.stroke();
        }
        ctx.restore();

        if(this.hp<this.maxHp){
            const width=this.radius*2;
            ctx.fillStyle="rgba(0,0,0,.55)";
            ctx.fillRect(this.x-width/2,this.y-this.radius-9,width,3);
            ctx.fillStyle="#75e68f";
            ctx.fillRect(this.x-width/2,this.y-this.radius-9,width*(this.hp/this.maxHp),3);
        }
    }
}

class EnemyBullet{
    constructor(x,y,angle,speed,damage,color="#ff6474",radius=5){
        this.x=x;
        this.y=y;
        this.vx=Math.cos(angle)*speed;
        this.vy=Math.sin(angle)*speed;
        this.damage=damage;
        this.color=color;
        this.radius=radius;
        this.life=5;
        this.dead=false;
        this.reflected=false;
    }

    update(dt){
        this.x+=this.vx*dt;
        this.y+=this.vy*dt;
        this.life-=dt;
        const player=game.player;
        if(!this.reflected&&player.shield>0&&distance(this,player)<34+this.radius){
            const angle=angleTo(player,this);
            this.vx=Math.cos(angle)*480;
            this.vy=Math.sin(angle)*480;
            this.damage*=1.8;
            this.reflected=true;
            this.color="#62ecff";
            sound.shieldReflect();
        }else if(!this.reflected&&circlesTouch(this,player)){
            this.dead=true;
            player.takeDamage(this.damage);
        }
        if(this.reflected){
            for(const enemy of game.enemies){
                if(!enemy.dead&&circlesTouch(this,enemy)){
                    enemy.takeDamage(this.damage,{vx:this.vx,vy:this.vy,knockback:40},false);
                    sound.hit();
                    this.dead=true;
                    break;
                }
            }
            if(game.boss&&!game.boss.dead&&circlesTouch(this,game.boss)){
                game.boss.takeDamage(this.damage);
                sound.hit();
                this.dead=true;
            }
        }
    }

    draw(){
        ctx.save();
        ctx.fillStyle=this.color;
        ctx.shadowBlur=14;
        ctx.shadowColor=this.color;
        ctx.beginPath();
        ctx.arc(this.x,this.y,this.radius,0,TAU);
        ctx.fill();
        ctx.restore();
    }
}

class Boss{
    constructor(level){
        const spawn=game.edgeSpawn(55);
        this.level=level;
        this.x=spawn.x;
        this.y=spawn.y;
        this.radius=35+Math.min(9,level*1.5);
        this.maxHp=Math.round(620*Math.pow(1.24,level-1));
        this.hp=this.maxHp;
        this.speed=Math.min(95,52+level*4);
        this.damage=Math.min(34,16+level*2);
        this.phase=1;
        this.shootTimer=1.2;
        this.skillTimer=3.5;
        this.state="chase";
        this.stateTimer=0;
        this.target={x:0,y:0};
        this.skill="";
        this.dead=false;
        this.flash=0;
        this.color=["#d84b66","#b74ed9","#e36e42","#d44793","#8559e8"][(level-1)%5];
    }

    update(dt){
        this.flash=Math.max(0,this.flash-dt);
        this.updatePhase();
        if(this.state!=="chase"){
            this.updateSkillState(dt);
            return;
        }
        const player=game.player;
        const angle=angleTo(this,player);
        const desiredDistance=this.level>=2?230:150;
        const d=distance(this,player);
        const direction=d>desiredDistance?1:d<desiredDistance-65?-.45:0;
        this.x+=Math.cos(angle)*this.speed*direction*dt;
        this.y+=Math.sin(angle)*this.speed*direction*dt;
        this.x=clamp(this.x,this.radius,W-this.radius);
        this.y=clamp(this.y,this.radius,H-this.radius);
        if(circlesTouch(this,player)){
            player.takeDamage(this.damage);
        }

        this.shootTimer-=dt;
        this.skillTimer-=dt;
        if(this.shootTimer<=0){
            this.fire();
        }
        if(this.skillTimer<=0){
            this.prepareSkill();
        }
    }

    updatePhase(){
        const ratio=this.hp/this.maxHp;
        const next=ratio<=.3?3:ratio<=.62?2:1;
        if(next!==this.phase){
            this.phase=next;
            game.notify(`BOSS PHASE ${next}`,"#ff80a0");
            game.spawnBurst(this.x,this.y,this.color,28,190);
            game.shake=10;
        }
    }

    fire(){
        const cooldown=Math.max(.48,1.18-this.level*.045-this.phase*.09);
        this.shootTimer=cooldown;
        const aim=angleTo(this,game.player);
        const count=this.phase===1?1:this.phase===2?3:5;
        for(let i=0;i<count;i++){
            const spread=(i-(count-1)/2)*.12;
            game.enemyBullets.push(new EnemyBullet(
                this.x,
                this.y,
                aim+spread,
                245+this.level*8,
                this.damage*.55,
                "#ff5f7c",
                5
            ));
        }
        sound.bossShot();
    }

    availableSkills(){
        const skills=["burst"];
        if(this.level>=2){
            skills.push("spread");
        }
        if(this.level>=3){
            skills.push("dash");
        }
        if(this.level>=4){
            skills.push("summon");
        }
        if(this.level>=5){
            skills.push("hazard");
        }
        return skills;
    }

    prepareSkill(){
        this.skill=choose(this.availableSkills());
        this.state="warning";
        this.stateTimer=this.skill==="dash"?1:.78;
        this.target={x:game.player.x,y:game.player.y};
        game.notify(this.skillName(),"#ff8da1");
        sound.bossWarning();
    }

    skillName(){
        return {
            burst:"BOSS: ENERGY BURST",
            spread:"BOSS: SPREAD SHOT",
            dash:"BOSS: CHARGE",
            summon:"BOSS: SUMMON",
            hazard:"BOSS: DANGER ZONE"
        }[this.skill];
    }

    updateSkillState(dt){
        this.stateTimer-=dt;
        if(this.state==="warning"&&this.stateTimer<=0){
            this.executeSkill();
            return;
        }
        if(this.state==="dash"){
            const angle=angleTo(this,this.target);
            this.x+=Math.cos(angle)*560*dt;
            this.y+=Math.sin(angle)*560*dt;
            if(distance(this,this.target)<25||this.stateTimer<=0){
                if(distance(this,game.player)<this.radius+game.player.radius+12){
                    game.player.takeDamage(this.damage*1.35);
                }
                this.state="recover";
                this.stateTimer=.85;
                game.spawnBurst(this.x,this.y,this.color,16,180);
            }
        }else if(this.state==="recover"&&this.stateTimer<=0){
            this.state="chase";
        }
    }

    executeSkill(){
        if(this.skill==="burst"){
            const count=12+this.phase*3;
            for(let i=0;i<count;i++){
                const angle=i/count*TAU;
                game.enemyBullets.push(new EnemyBullet(this.x,this.y,angle,220+this.phase*25,this.damage*.48,this.color,5));
            }
        }else if(this.skill==="spread"){
            const aim=angleTo(this,game.player);
            for(let i=-4;i<=4;i++){
                game.enemyBullets.push(new EnemyBullet(this.x,this.y,aim+i*.12,285,this.damage*.54,"#ff6e91",5));
            }
        }else if(this.skill==="dash"){
            this.state="dash";
            this.stateTimer=.65;
            return;
        }else if(this.skill==="summon"){
            const amount=3+this.phase;
            for(let i=0;i<amount;i++){
                const angle=i/amount*TAU;
                const position={
                    x:clamp(this.x+Math.cos(angle)*70,20,W-20),
                    y:clamp(this.y+Math.sin(angle)*70,20,H-20)
                };
                game.enemies.push(new Enemy(choose(["walker","runner","spitter"]),game.wave,position));
            }
        }else if(this.skill==="hazard"){
            for(let i=0;i<3+this.phase;i++){
                const x=clamp(game.player.x+random(-150,150),55,W-55);
                const y=clamp(game.player.y+random(-150,150),55,H-55);
                game.hazards.push(new Hazard(x,y,46+this.phase*3,this.damage*.8));
            }
        }
        game.shake=Math.min(11,game.shake+5);
        this.state="recover";
        this.stateTimer=.72;
        this.skillTimer=Math.max(3.5,7-this.level*.12-this.phase*.45);
    }

    takeDamage(amount,critical=false){
        if(this.dead){
            return;
        }
        this.hp-=amount;
        this.flash=.07;
        game.damageTexts.push(new DamageText(this.x,this.y,Math.round(amount),critical));
        if(this.hp<=0){
            this.die();
        }
    }

    die(){
        this.dead=true;
        game.bossesKilled++;
        game.score+=800*this.level;
        game.player.grenades=Math.min(game.player.maxGrenades,game.player.grenades+2);
        game.player.heal(35);
        game.enemyBullets.length=0;
        game.hazards.length=0;
        game.spawnBurst(this.x,this.y,this.color,70,290);
        game.shake=15;
        sound.explosion();
        game.pickups.push(new Pickup(this.x,this.y,"supply"));
        game.pendingUpgrade=true;
        game.updateSidePanel();
    }

    drawWarning(){
        if(this.state!=="warning"){
            return;
        }
        const alpha=.35+Math.sin(game.time*16)*.25;
        ctx.save();
        ctx.strokeStyle=`rgba(255,90,115,${alpha})`;
        ctx.fillStyle=`rgba(255,70,95,${alpha*.18})`;
        ctx.lineWidth=3;
        ctx.setLineDash([8,7]);
        if(this.skill==="dash"){
            ctx.beginPath();
            ctx.moveTo(this.x,this.y);
            ctx.lineTo(this.target.x,this.target.y);
            ctx.stroke();
        }else if(this.skill==="hazard"){
            ctx.beginPath();
            ctx.arc(game.player.x,game.player.y,90,0,TAU);
            ctx.fill();
            ctx.stroke();
        }else{
            ctx.beginPath();
            ctx.arc(this.x,this.y,this.radius+20+Math.sin(game.time*12)*5,0,TAU);
            ctx.stroke();
        }
        ctx.restore();
    }

    draw(){
        this.drawWarning();
        ctx.save();
        ctx.translate(this.x,this.y);
        const gradient=ctx.createRadialGradient(-10,-12,4,0,0,this.radius);
        gradient.addColorStop(0,this.flash>0?"#fff":"#ffb0c0");
        gradient.addColorStop(.3,this.flash>0?"#fff":this.color);
        gradient.addColorStop(1,"#401b32");
        ctx.fillStyle=gradient;
        ctx.shadowBlur=18;
        ctx.shadowColor=this.color;
        ctx.beginPath();
        ctx.arc(0,0,this.radius,0,TAU);
        ctx.fill();
        ctx.lineWidth=4;
        ctx.strokeStyle=this.phase===3?"#ffd25e":"#ff9ab0";
        ctx.stroke();
        ctx.fillStyle="#2a0e1d";
        ctx.beginPath();
        ctx.arc(12,-9,4,0,TAU);
        ctx.arc(12,9,4,0,TAU);
        ctx.fill();
        ctx.restore();
    }
}

class Hazard{
    constructor(x,y,radius,damage){
        this.x=x;
        this.y=y;
        this.radius=radius;
        this.damage=damage;
        this.timer=1.15;
        this.active=.75;
        this.dead=false;
        this.hit=false;
    }

    update(dt){
        this.timer-=dt;
        if(this.timer<=0){
            this.active-=dt;
            if(!this.hit&&distance(this,game.player)<this.radius+game.player.radius){
                game.player.takeDamage(this.damage);
                this.hit=true;
            }
            if(this.active<=0){
                this.dead=true;
            }
        }
    }

    draw(){
        const warning=this.timer>0;
        ctx.save();
        ctx.fillStyle=warning?"rgba(255,75,88,.12)":"rgba(255,104,55,.27)";
        ctx.strokeStyle=warning?"rgba(255,90,105,.8)":"rgba(255,168,70,.9)";
        ctx.lineWidth=warning?2:4;
        ctx.setLineDash(warning?[7,6]:[]);
        ctx.beginPath();
        ctx.arc(this.x,this.y,this.radius,0,TAU);
        ctx.fill();
        ctx.stroke();
        if(warning){
            ctx.beginPath();
            ctx.arc(this.x,this.y,this.radius*(1-clamp(this.timer/1.15,0,1)),0,TAU);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class Grenade{
    constructor(x,y,targetX,targetY){
        this.x=x;
        this.y=y;
        const angle=Math.atan2(targetY-y,targetX-x);
        const range=Math.min(330,Math.hypot(targetX-x,targetY-y));
        this.targetX=x+Math.cos(angle)*range;
        this.targetY=y+Math.sin(angle)*range;
        this.startX=x;
        this.startY=y;
        this.timer=.72;
        this.total=.72;
        this.radius=6;
        this.dead=false;
    }

    update(dt){
        this.timer-=dt;
        const progress=1-clamp(this.timer/this.total,0,1);
        this.x=lerp(this.startX,this.targetX,progress);
        this.y=lerp(this.startY,this.targetY,progress)-Math.sin(progress*Math.PI)*55;
        if(this.timer<=0){
            this.explode();
        }
    }

    explode(){
        this.dead=true;
        const radius=125;
        game.enemies.forEach(enemy=>{
            if(!enemy.dead&&distance(enemy,{x:this.targetX,y:this.targetY})<radius+enemy.radius){
                enemy.takeDamage(125*game.player.damageMultiplier,{vx:enemy.x-this.targetX,vy:enemy.y-this.targetY,knockback:160});
            }
        });
        if(game.boss&&!game.boss.dead&&distance(game.boss,{x:this.targetX,y:this.targetY})<radius+game.boss.radius){
            game.boss.takeDamage(175*game.player.damageMultiplier);
        }
        game.spawnBurst(this.targetX,this.targetY,"#ffba5c",42,310);
        game.explosions.push({x:this.targetX,y:this.targetY,radius:0,maxRadius:radius,life:.35});
        game.shake=14;
        sound.explosion();
    }

    draw(){
        ctx.save();
        ctx.fillStyle="#dfe7eb";
        ctx.shadowBlur=8;
        ctx.shadowColor="#fff";
        ctx.beginPath();
        ctx.arc(this.x,this.y,this.radius,0,TAU);
        ctx.fill();
        ctx.restore();
    }
}

class Pickup{
    constructor(x,y,type){
        this.x=x;
        this.y=y;
        this.type=type;
        this.radius=12;
        this.life=14;
        this.dead=false;
        this.phase=random(0,TAU);
    }

    update(dt){
        this.life-=dt;
        this.phase+=dt*3;
        if(this.life<=0){
            this.dead=true;
        }
        if(circlesTouch(this,game.player)){
            this.collect();
        }
    }

    collect(){
        let changed=false;
        if(this.type==="supply"){
            const ammoChanged=game.player.weapons.addSupplies();
            const before=game.player.grenades;
            game.player.grenades=Math.min(game.player.maxGrenades,game.player.grenades+1);
            const grenadeChanged=game.player.grenades>before;
            changed=ammoChanged||grenadeChanged;
            if(changed){
                game.notify(grenadeChanged?"TIẾP TẾ: ĐẠN + 1 GRENADE":"TIẾP TẾ: ĐẠN","#68e8ff");
            }
        }else if(this.type==="health"){
            changed=game.player.heal(28);
            if(changed){
                game.notify("HỒI 28 HP","#76ee9a");
            }
        }
        if(changed){
            this.dead=true;
            sound.pickup();
            game.spawnBurst(this.x,this.y,this.type==="health"?"#71ef92":"#60dcff",15,150);
        }
    }

    draw(){
        const y=this.y+Math.sin(this.phase)*3;
        ctx.save();
        ctx.translate(this.x,y);
        ctx.rotate(this.phase*.18);
        ctx.fillStyle=this.type==="health"?"#4ed879":"#36bde2";
        ctx.shadowBlur=16;
        ctx.shadowColor=ctx.fillStyle;
        ctx.fillRect(-10,-10,20,20);
        ctx.strokeStyle="#dffaff";
        ctx.lineWidth=2;
        ctx.strokeRect(-10,-10,20,20);
        ctx.rotate(-this.phase*.18);
        ctx.fillStyle="#fff";
        if(this.type==="health"){
            ctx.fillRect(-2,-7,4,14);
            ctx.fillRect(-7,-2,14,4);
        }else{
            ctx.font="800 10px Arial";
            ctx.textAlign="center";
            ctx.textBaseline="middle";
            ctx.fillText("AM",0,1);
        }
        ctx.restore();
    }
}

class Particle{
    constructor(x,y,color,size,life,vx,vy){
        this.x=x;
        this.y=y;
        this.color=color;
        this.size=size;
        this.life=life;
        this.maxLife=life;
        this.vx=vx;
        this.vy=vy;
    }

    update(dt){
        this.x+=this.vx*dt;
        this.y+=this.vy*dt;
        this.vx*=Math.pow(.03,dt);
        this.vy*=Math.pow(.03,dt);
        this.life-=dt;
    }

    draw(){
        ctx.save();
        ctx.globalAlpha=clamp(this.life/this.maxLife,0,1);
        ctx.fillStyle=this.color;
        ctx.fillRect(this.x-this.size/2,this.y-this.size/2,this.size,this.size);
        ctx.restore();
    }
}

class DamageText{
    constructor(x,y,value,critical){
        this.x=x;
        this.y=y;
        this.value=value;
        this.critical=critical;
        this.life=.65;
        this.maxLife=.65;
    }

    update(dt){
        this.y-=42*dt;
        this.life-=dt;
    }

    draw(){
        ctx.save();
        ctx.globalAlpha=clamp(this.life/this.maxLife,0,1);
        ctx.fillStyle=this.critical?"#ffe66d":"#f4fbff";
        ctx.font=this.critical?"800 18px Arial":"700 13px Arial";
        ctx.textAlign="center";
        ctx.fillText(`${this.critical?"CRIT ":""}${this.value}`,this.x,this.y);
        ctx.restore();
    }
}

const UPGRADES=[
    {
        id:"damage",
        icon:"DMG",
        name:"Đạn cường hóa",
        description:"+18% sát thương cho mọi vũ khí.",
        apply:player=>player.damageMultiplier*=1.18
    },
    {
        id:"fire",
        icon:"RPM",
        name:"Cò súng nhanh",
        description:"+12% tốc độ bắn.",
        apply:player=>player.fireRateMultiplier=Math.max(.48,player.fireRateMultiplier*.88)
    },
    {
        id:"reload",
        icon:"RLD",
        name:"Nạp đạn chiến thuật",
        description:"Giảm 18% thời gian reload.",
        apply:player=>player.reloadMultiplier=Math.max(.42,player.reloadMultiplier*.82)
    },
    {
        id:"health",
        icon:"HP",
        name:"Giáp sinh tồn",
        description:"+25 HP tối đa và hồi đầy 25 HP vừa tăng.",
        apply:player=>{
            player.maxHp+=25;
            player.hp=Math.min(player.maxHp,player.hp+25);
        }
    },
    {
        id:"speed",
        icon:"SPD",
        name:"Bước chân nhẹ",
        description:"+10% tốc độ di chuyển.",
        apply:player=>player.speed=Math.min(360,player.speed*1.1)
    },
    {
        id:"pierce",
        icon:"PEN",
        name:"Đạn xuyên phá",
        description:"+1 mục tiêu xuyên qua cho mọi viên đạn.",
        apply:player=>player.extraPierce=Math.min(4,player.extraPierce+1)
    },
    {
        id:"crit",
        icon:"CRT",
        name:"Ống ngắm chính xác",
        description:"+6% tỉ lệ chí mạng.",
        apply:player=>player.critChance=Math.min(.38,player.critChance+.06)
    },
    {
        id:"dash",
        icon:"DSH",
        name:"Bộ đẩy cải tiến",
        description:"Dash hồi nhanh hơn 18%.",
        apply:player=>player.dashCooldownMax=Math.max(.85,player.dashCooldownMax*.82)
    },
    {
        id:"shield",
        icon:"SHD",
        name:"Lõi Shield",
        description:"Shield lâu hơn 0.45 giây và hồi nhanh hơn.",
        apply:player=>{
            player.shieldDuration=Math.min(5,player.shieldDuration+.45);
            player.shieldCooldownMax=Math.max(3.5,player.shieldCooldownMax-.7);
        }
    },
    {
        id:"grenade",
        icon:"GRN",
        name:"Túi Grenade",
        description:"+2 sức chứa và nhận ngay 2 Grenade.",
        apply:player=>{
            player.maxGrenades=Math.min(20,player.maxGrenades+2);
            player.grenades=Math.min(player.maxGrenades,player.grenades+2);
        }
    }
];

class Game{
    constructor(){
        this.colors={danger:"#ff5e6c",cyan:"#57dcff",yellow:"#ffd166"};
        this.player=new Player();
        this.state="menu";
        this.lastTime=0;
        this.accumulator=0;
        this.fixedStep=1/120;
        this.settingsPreviousState="menu";
        this.resetCollections();
        this.resetStats();
        this.bindUI();
        this.renderKeyBindings();
        this.updateControlList();
        this.updateSidePanel();
        requestAnimationFrame(time=>this.loop(time));
    }

    resetCollections(){
        this.bullets=[];
        this.enemyBullets=[];
        this.enemies=[];
        this.particles=[];
        this.damageTexts=[];
        this.pickups=[];
        this.grenades=[];
        this.hazards=[];
        this.explosions=[];
        this.boss=null;
    }

    resetStats(){
        this.time=0;
        this.score=0;
        this.kills=0;
        this.combo=0;
        this.comboTimer=0;
        this.bestCombo=0;
        this.wave=1;
        this.waveState="break";
        this.waveTimer=2;
        this.spawnTimer=0;
        this.waveSpawned=0;
        this.waveTarget=0;
        this.bossesKilled=0;
        this.notification={text:"",color:"#fff",life:0};
        this.shake=0;
        this.flash=0;
        this.pendingUpgrade=false;
    }

    bindUI(){
        ui.startButton.addEventListener("click",()=>this.start());
        ui.restartButton.addEventListener("click",()=>this.start());
        ui.resumeButton.addEventListener("click",()=>this.resume());
        ui.pauseButton.addEventListener("click",()=>{
            if(this.state==="playing"){
                this.pause();
            }else if(this.state==="paused"){
                this.resume();
            }
        });
        ui.settingsButton.addEventListener("click",()=>this.openSettings());
        ui.closeSettingsButton.addEventListener("click",()=>this.closeSettings());
        ui.resetKeysButton.addEventListener("click",()=>{
            input.resetBindings();
            this.renderKeyBindings();
            this.updateControlList();
        });
        ui.soundButton.addEventListener("click",()=>{
            sound.enabled=!sound.enabled;
            sound.unlock();
            ui.soundButton.textContent=`Âm thanh: ${sound.enabled?"Bật":"Tắt"}`;
        });
        window.addEventListener("keydown",event=>{
            if(event.key==="Enter"&&this.state==="menu"){
                this.start();
            }
            if(input.isActionKey("pause",event.key)){
                if(this.state==="playing"){
                    this.pause();
                }else if(this.state==="paused"){
                    this.resume();
                }
            }
        });
    }

    showScreen(screen){
        [ui.startScreen,ui.pauseScreen,ui.upgradeScreen,ui.gameOverScreen,ui.settingsScreen].forEach(item=>item.classList.remove("active"));
        if(screen){
            screen.classList.add("active");
        }
    }

    openSettings(){
        if(this.state==="settings"){
            return;
        }
        this.settingsPreviousState=this.state;
        this.state="settings";
        input.mouse.down=false;
        input.rebinding=null;
        if(this.settingsPreviousState==="playing"){
            ui.pauseButton.textContent="Tiếp tục";
        }
        this.renderKeyBindings();
        this.showScreen(ui.settingsScreen);
    }

    closeSettings(){
        if(this.state!=="settings"){
            return;
        }
        input.rebinding=null;
        this.state=this.settingsPreviousState;
        if(this.state==="playing"){
            this.lastTime=performance.now();
        }
        ui.pauseButton.textContent=this.state==="paused"?"Tiếp tục":"Tạm dừng";
        this.showScreen(this.state==="menu"?ui.startScreen:this.state==="paused"?ui.pauseScreen:this.state==="upgrade"?ui.upgradeScreen:this.state==="gameover"?ui.gameOverScreen:null);
    }

    renderKeyBindings(){
        ui.keyBindings.innerHTML="";
        Object.keys(DEFAULT_KEY_BINDINGS).forEach(action=>{
            const row=document.createElement("div");
            row.className="key-binding-row";
            const label=document.createElement("span");
            label.textContent=KEY_BINDING_LABELS[action];
            const button=document.createElement("button");
            button.type="button";
            button.className="key-binding-button";
            button.textContent=displayKey(input.bindings[action]);
            button.addEventListener("click",()=>{
                document.querySelectorAll(".key-binding-button").forEach(item=>item.classList.remove("waiting"));
                button.classList.add("waiting");
                button.textContent="Nhấn phím...";
                input.beginRebind(action,key=>{
                    this.renderKeyBindings();
                    if(key){
                        this.updateControlList();
                    }
                });
            });
            row.append(label,button);
            ui.keyBindings.appendChild(row);
        });
    }

    updateControlList(){
        const rows=[
            ["moveUp","Lên"],["moveDown","Xuống"],["moveLeft","Trái"],["moveRight","Phải"],
            ["reload","Nạp đạn"],["weapon1","Đổi sang Pistol"],["weapon2","Đổi sang Shotgun"],
            ["weapon3","Đổi sang Laser Gun"],["weapon4","Đổi sang Machine Gun"],["weapon5","Đổi sang Plasma Rifle"],
            ["grenade","Grenade"],["shield","Shield"],["dash","Dash"],["pause","Tạm dừng"]
        ];
        ui.controlList.innerHTML=rows.map(([action,label])=>`<p><kbd>${displayKey(input.bindings[action])}</kbd><span>${label}</span></p>`).join("");
        ui.controlList.insertAdjacentHTML("beforeend","<p><kbd>Chuột trái</kbd><span>Bắn</span></p><p><kbd>Chuột phải</kbd><span>Dash theo hướng di chuyển</span></p>");
    }

    start(){
        sound.unlock();
        this.resetCollections();
        this.resetStats();
        this.player.reset();
        this.state="playing";
        this.showScreen(null);
        ui.pauseButton.textContent="Tạm dừng";
        this.beginWave();
    }

    pause(){
        if(this.state!=="playing"){
            return;
        }
        this.state="paused";
        input.mouse.down=false;
        ui.pauseButton.textContent="Tiếp tục";
        this.showScreen(ui.pauseScreen);
    }

    resume(){
        if(this.state!=="paused"){
            return;
        }
        this.state="playing";
        ui.pauseButton.textContent="Tạm dừng";
        this.showScreen(null);
        this.lastTime=performance.now();
    }

    endGame(){
        this.state="gameover";
        input.mouse.down=false;
        ui.pauseButton.textContent="Tạm dừng";
        this.showScreen(ui.gameOverScreen);
        const minutes=Math.floor(this.time/60);
        const seconds=Math.floor(this.time%60).toString().padStart(2,"0");
        ui.finalStats.innerHTML=`
            <div><span>Điểm</span><strong>${this.score}</strong></div>
            <div><span>Wave</span><strong>${this.wave}</strong></div>
            <div><span>Zombie</span><strong>${this.kills}</strong></div>
            <div><span>Thời gian</span><strong>${minutes}:${seconds}</strong></div>
        `;
    }

    beginWave(){
        this.waveState="spawning";
        this.waveSpawned=0;
        this.spawnTimer=.8;
        this.waveTarget=8+this.wave*3+Math.floor(this.wave*.65);
        this.notify(`WAVE ${this.wave}`,"#57dcff");
        this.updateSidePanel();
    }

    finishWave(){
        this.waveState="break";
        this.waveTimer=3.2;
        this.pickups.push(new Pickup(W/2+random(-80,80),H/2+random(-60,60),"supply"));
        this.player.heal(8);
        this.notify("WAVE CLEARED","#6ef2a4");
    }

    spawnBoss(){
        const level=Math.ceil(this.wave/5);
        this.boss=new Boss(level);
        this.waveSpawned=this.waveTarget;
        this.notify(`BOSS ${level}: PHASE 1`,"#ff6f91");
        sound.boss();
        this.updateSidePanel();
    }

    updateWave(dt){
        if(this.waveState==="break"){
            this.waveTimer-=dt;
            if(this.waveTimer<=0){
                this.wave++;
                this.beginWave();
            }
            return;
        }
        if(this.wave%5===0&&this.waveSpawned===0&&!this.boss){
            this.spawnBoss();
            return;
        }
        if(this.wave%5!==0&&this.waveSpawned<this.waveTarget){
            this.spawnTimer-=dt;
            if(this.spawnTimer<=0){
                this.spawnTimer=Math.max(.18,.78-this.wave*.018);
                const amount=this.wave>=8&&Math.random()<.18?2:1;
                for(let i=0;i<amount&&this.waveSpawned<this.waveTarget;i++){
                    this.enemies.push(new Enemy(this.chooseEnemyType(),this.wave));
                    this.waveSpawned++;
                }
                this.updateSidePanel();
            }
        }
        const activeEnemies=this.enemies.filter(enemy=>!enemy.dead).length;
        const regularWaveDone=this.wave%5!==0&&this.waveSpawned>=this.waveTarget&&activeEnemies===0;
        const bossWaveDone=this.wave%5===0&&this.boss?.dead&&activeEnemies===0;
        if(regularWaveDone){
            this.finishWave();
        }else if(bossWaveDone&&this.pendingUpgrade){
            this.pendingUpgrade=false;
            this.openUpgrade();
        }
    }

    chooseEnemyType(){
        const pool=["walker","walker","walker"];
        if(this.wave>=2){
            pool.push("runner");
        }
        if(this.wave>=3){
            pool.push("tank");
        }
        if(this.wave>=4){
            pool.push("spitter");
        }
        if(this.wave>=6){
            pool.push("exploder");
        }
        return choose(pool);
    }

    openUpgrade(){
        this.state="upgrade";
        input.mouse.down=false;
        const choices=shuffle(UPGRADES).slice(0,3);
        ui.upgradeChoices.innerHTML="";
        choices.forEach(upgrade=>{
            const button=document.createElement("button");
            button.type="button";
            button.className="upgrade-card";
            button.innerHTML=`
                <span class="upgrade-icon">${upgrade.icon}</span>
                <strong>${upgrade.name}</strong>
                <span>${upgrade.description}</span>
            `;
            button.addEventListener("click",()=>{
                upgrade.apply(this.player);
                this.state="playing";
                this.showScreen(null);
                this.boss=null;
                this.waveState="break";
                this.waveTimer=3.5;
                this.notify(`UPGRADE: ${upgrade.name}`,"#ffd166");
            },{once:true});
            ui.upgradeChoices.appendChild(button);
        });
        this.showScreen(ui.upgradeScreen);
    }

    edgeSpawn(padding=30){
        const side=Math.floor(Math.random()*4);
        if(side===0){
            return {x:random(0,W),y:-padding};
        }
        if(side===1){
            return {x:W+padding,y:random(0,H)};
        }
        if(side===2){
            return {x:random(0,W),y:H+padding};
        }
        return {x:-padding,y:random(0,H)};
    }

    throwGrenade(){
        if(this.player.grenades<=0){
            this.notify("HẾT GRENADE",this.colors.danger);
            return;
        }
        this.player.grenades--;
        this.grenades.push(new Grenade(this.player.x,this.player.y,input.mouse.x,input.mouse.y));
    }

    registerKill(baseScore,x,y){
        this.kills++;
        this.combo++;
        this.comboTimer=2.8;
        this.bestCombo=Math.max(this.bestCombo,this.combo);
        const multiplier=1+Math.min(4,Math.floor(this.combo/5)*.25);
        this.score+=Math.round(baseScore*multiplier);
        if(this.player.lifeSteal>0&&this.kills%this.player.lifeSteal===0){
            this.player.heal(3);
        }
        if(this.kills%35===0){
            this.pickups.push(new Pickup(x,y,"supply"));
        }
        this.updateSidePanel();
    }

    notify(text,color="#fff"){
        this.notification={text,color,life:1.7};
    }

    spawnBurst(x,y,color,count=10,speed=130){
        for(let i=0;i<count;i++){
            const angle=random(0,TAU);
            const velocity=random(speed*.25,speed);
            this.particles.push(new Particle(
                x,
                y,
                color,
                random(2,5),
                random(.2,.65),
                Math.cos(angle)*velocity,
                Math.sin(angle)*velocity
            ));
        }
    }

    spawnMuzzle(x,y,angle,color){
        for(let i=0;i<4;i++){
            const velocity=random(70,160);
            const spread=random(-.22,.22);
            this.particles.push(new Particle(
                x+Math.cos(angle)*28,
                y+Math.sin(angle)*28,
                color,
                random(2,4),
                .16,
                Math.cos(angle+spread)*velocity,
                Math.sin(angle+spread)*velocity
            ));
        }
    }

    updateSidePanel(){
        ui.waveLabel.textContent=`Wave ${this.wave}`;
        const alive=this.enemies.filter(enemy=>!enemy.dead).length;
        const waiting=Math.max(0,this.waveTarget-this.waveSpawned);
        ui.enemyLabel.textContent=this.boss&&!this.boss.dead?"BOSS":alive+waiting;
        ui.bossLabel.textContent=this.bossesKilled;
    }

    update(dt){
        this.time+=dt;
        this.notification.life=Math.max(0,this.notification.life-dt);
        this.comboTimer=Math.max(0,this.comboTimer-dt);
        this.flash=Math.max(0,this.flash-dt);
        this.shake=lerp(this.shake,0,Math.min(1,dt*11));
        if(this.comboTimer<=0){
            this.combo=0;
        }

        this.player.update(dt);
        this.updateWave(dt);
        this.enemies.forEach(enemy=>enemy.update(dt));
        this.boss?.update(dt);
        this.bullets.forEach(bullet=>bullet.update(dt));
        this.enemyBullets.forEach(bullet=>bullet.update(dt));
        this.grenades.forEach(grenade=>grenade.update(dt));
        this.pickups.forEach(pickup=>pickup.update(dt));
        this.hazards.forEach(hazard=>hazard.update(dt));
        this.particles.forEach(particle=>particle.update(dt));
        this.damageTexts.forEach(text=>text.update(dt));
        this.updateExplosions(dt);
        this.handleBulletCollisions();
        this.cleanup();
    }

    handleBulletCollisions(){
        for(const bullet of this.bullets){
            if(bullet.life<=0){
                continue;
            }
            let collided=false;
            for(const enemy of this.enemies){
                if(enemy.dead||bullet.hit.has(enemy)||!circlesTouch(bullet,enemy)){
                    continue;
                }
                const critical=Math.random()<bullet.critChance;
                const damage=bullet.damage*(critical?bullet.critMultiplier:1);
                enemy.takeDamage(damage,bullet,critical);
                bullet.hit.add(enemy);
                collided=true;
                if(bullet.splash>0){
                    this.applySplash(enemy.x,enemy.y,bullet.splash,damage*.35,enemy);
                }
                if(bullet.pierce>0){
                    bullet.pierce--;
                }else{
                    bullet.life=0;
                    break;
                }
            }
            if(this.boss&&!this.boss.dead&&!bullet.hit.has(this.boss)&&circlesTouch(bullet,this.boss)){
                const critical=Math.random()<bullet.critChance;
                const damage=bullet.damage*(critical?bullet.critMultiplier:1);
                this.boss.takeDamage(damage,critical);
                bullet.hit.add(this.boss);
                collided=true;
                if(bullet.pierce>0){
                    bullet.pierce--;
                }else{
                    bullet.life=0;
                }
            }
            if(collided){
                sound.hit();
            }
        }
    }

    applySplash(x,y,radius,damage,ignored){
        this.enemies.forEach(enemy=>{
            if(enemy!==ignored&&!enemy.dead&&distance(enemy,{x,y})<radius+enemy.radius){
                enemy.takeDamage(damage,{vx:enemy.x-x,vy:enemy.y-y,knockback:45});
            }
        });
        if(this.boss&&this.boss!==ignored&&!this.boss.dead&&distance(this.boss,{x,y})<radius+this.boss.radius){
            this.boss.takeDamage(damage);
        }
        this.explosions.push({x,y,radius:0,maxRadius:radius,life:.18});
    }

    updateExplosions(dt){
        this.explosions.forEach(explosion=>{
            explosion.life-=dt;
            explosion.radius=lerp(explosion.radius,explosion.maxRadius,Math.min(1,dt*18));
        });
    }

    cleanup(){
        this.bullets=this.bullets.filter(bullet=>bullet.life>0&&bullet.x>-40&&bullet.x<W+40&&bullet.y>-40&&bullet.y<H+40);
        this.enemyBullets=this.enemyBullets.filter(bullet=>!bullet.dead&&bullet.life>0&&bullet.x>-80&&bullet.x<W+80&&bullet.y>-80&&bullet.y<H+80);
        this.enemies=this.enemies.filter(enemy=>!enemy.dead);
        this.grenades=this.grenades.filter(grenade=>!grenade.dead);
        this.pickups=this.pickups.filter(pickup=>!pickup.dead);
        this.hazards=this.hazards.filter(hazard=>!hazard.dead);
        this.particles=this.particles.filter(particle=>particle.life>0);
        this.damageTexts=this.damageTexts.filter(text=>text.life>0);
        this.explosions=this.explosions.filter(explosion=>explosion.life>0);
    }

    drawBackground(){
        const gradient=ctx.createLinearGradient(0,0,W,H);
        gradient.addColorStop(0,"#101a21");
        gradient.addColorStop(1,"#0a1117");
        ctx.fillStyle=gradient;
        ctx.fillRect(0,0,W,H);
        ctx.strokeStyle="rgba(104,175,196,.055)";
        ctx.lineWidth=1;
        const grid=48;
        const offset=(this.time*8)%grid;
        for(let x=-grid+offset;x<W;x+=grid){
            ctx.beginPath();
            ctx.moveTo(x,0);
            ctx.lineTo(x,H);
            ctx.stroke();
        }
        for(let y=-grid+offset;y<H;y+=grid){
            ctx.beginPath();
            ctx.moveTo(0,y);
            ctx.lineTo(W,y);
            ctx.stroke();
        }
        ctx.strokeStyle="rgba(92,219,255,.16)";
        ctx.lineWidth=2;
        ctx.strokeRect(7,7,W-14,H-14);
    }

    drawHud(){
        const player=this.player;
        const weapon=player.weapons.definition;
        const ammo=player.weapons.currentAmmo;
        this.drawBar(22,22,220,17,player.hp/player.maxHp,"#ff5e6c",`HP ${Math.ceil(player.hp)} / ${player.maxHp}`);
        this.drawBar(22,47,220,10,1-player.dashCooldown/player.dashCooldownMax,"#57dcff","DASH");
        this.drawBar(22,64,220,10,1-player.shieldCooldown/player.shieldCooldownMax,"#b77cff","SHIELD");

        ctx.save();
        ctx.textAlign="right";
        ctx.fillStyle="#eefaff";
        ctx.font="800 24px Arial";
        ctx.fillText(this.score.toLocaleString("vi-VN"),W-22,35);
        ctx.fillStyle="#8da2b3";
        ctx.font="700 10px Arial";
        ctx.fillText(`ĐIỂM  •  KILL ${this.kills}`,W-22,51);
        ctx.restore();

        const panelY=H-76;
        ctx.fillStyle="rgba(5,10,15,.82)";
        ctx.fillRect(15,panelY,W-30,61);
        ctx.strokeStyle="rgba(120,220,255,.17)";
        ctx.strokeRect(15,panelY,W-30,61);

        ctx.fillStyle=weapon.color;
        ctx.font="800 15px Arial";
        ctx.fillText(`${player.weapons.selected+1}. ${weapon.name}`,28,panelY+22);
        ctx.fillStyle="#fff";
        ctx.font="800 24px Arial";
        ctx.fillText(`${ammo.magazine}`,28,panelY+50);
        ctx.fillStyle="#8297a8";
        ctx.font="700 13px Arial";
        ctx.fillText(`/ ${ammo.reserve}`,60,panelY+49);

        if(player.weapons.reloading){
            const duration=weapon.reload*player.reloadMultiplier;
            const progress=1-clamp(player.weapons.reloadTimer/duration,0,1);
            ctx.fillStyle="rgba(255,255,255,.1)";
            ctx.fillRect(115,panelY+35,150,6);
            ctx.fillStyle=weapon.color;
            ctx.fillRect(115,panelY+35,150*progress,6);
            ctx.fillStyle="#cfe6f1";
            ctx.font="700 10px Arial";
            ctx.fillText(weapon.shellReload?"NẠP TỪNG VIÊN":"ĐANG RELOAD",115,panelY+25);
        }

        ctx.textAlign="center";
        WEAPONS.forEach((item,index)=>{
            const x=365+index*72;
            const selected=index===player.weapons.selected;
            ctx.fillStyle=selected?item.color:"rgba(255,255,255,.1)";
            ctx.fillRect(x-26,panelY+9,52,35);
            ctx.fillStyle=selected?"#071016":"#8ca0af";
            ctx.font="800 10px Arial";
            ctx.fillText(`${index+1} ${item.short}`,x,panelY+30);
        });

        ctx.textAlign="right";
        ctx.fillStyle="#ffd166";
        ctx.font="800 16px Arial";
        ctx.fillText(`GRENADE ${player.grenades}/${player.maxGrenades}`,W-28,panelY+25);
        ctx.fillStyle="#8da2b3";
        ctx.font="700 10px Arial";
        ctx.fillText("G để ném",W-28,panelY+43);
        ctx.textAlign="left";

        if(this.combo>=2){
            ctx.save();
            ctx.textAlign="center";
            ctx.fillStyle="#ffd166";
            ctx.font="900 23px Arial";
            ctx.fillText(`COMBO x${this.combo}`,W/2,45);
            ctx.restore();
        }

        if(this.notification.life>0){
            ctx.save();
            ctx.globalAlpha=Math.min(1,this.notification.life*2);
            ctx.textAlign="center";
            ctx.fillStyle=this.notification.color;
            ctx.font="900 18px Arial";
            ctx.shadowBlur=15;
            ctx.shadowColor=this.notification.color;
            ctx.fillText(this.notification.text,W/2,82);
            ctx.restore();
        }

        if(this.waveState==="break"&&this.state==="playing"){
            ctx.save();
            ctx.textAlign="center";
            ctx.fillStyle="rgba(238,250,255,.75)";
            ctx.font="700 12px Arial";
            ctx.fillText(`WAVE TIẾP THEO SAU ${Math.max(0,this.waveTimer).toFixed(1)}s`,W/2,105);
            ctx.restore();
        }

        if(this.boss&&!this.boss.dead){
            const boss=this.boss;
            const width=430;
            const x=(W-width)/2;
            ctx.fillStyle="rgba(0,0,0,.7)";
            ctx.fillRect(x,112,width,14);
            ctx.fillStyle=boss.color;
            ctx.fillRect(x,112,width*(boss.hp/boss.maxHp),14);
            ctx.strokeStyle="rgba(255,255,255,.5)";
            ctx.strokeRect(x,112,width,14);
            ctx.fillStyle="#fff";
            ctx.textAlign="center";
            ctx.font="800 10px Arial";
            ctx.fillText(`BOSS ${boss.level}  •  PHASE ${boss.phase}`,W/2,108);
            ctx.textAlign="left";
        }
    }

    drawBar(x,y,width,height,ratio,color,label){
        ratio=clamp(ratio,0,1);
        ctx.fillStyle="rgba(0,0,0,.58)";
        ctx.fillRect(x,y,width,height);
        ctx.fillStyle=color;
        ctx.fillRect(x,y,width*ratio,height);
        ctx.strokeStyle="rgba(255,255,255,.2)";
        ctx.strokeRect(x,y,width,height);
        ctx.fillStyle="#fff";
        ctx.font=`700 ${height>=15?10:8}px Arial`;
        ctx.fillText(label,x+6,y+height-4);
    }

    draw(){
        ctx.save();
        const shakeX=this.shake>0?random(-this.shake,this.shake):0;
        const shakeY=this.shake>0?random(-this.shake,this.shake):0;
        ctx.translate(shakeX,shakeY);
        this.drawBackground();
        this.hazards.forEach(hazard=>hazard.draw());
        this.pickups.forEach(pickup=>pickup.draw());
        this.enemies.forEach(enemy=>enemy.draw());
        this.boss?.draw();
        this.grenades.forEach(grenade=>grenade.draw());
        this.bullets.forEach(bullet=>bullet.draw());
        this.enemyBullets.forEach(bullet=>bullet.draw());
        this.explosions.forEach(explosion=>{
            ctx.save();
            ctx.globalAlpha=clamp(explosion.life*3,0,1);
            ctx.strokeStyle="#ffbd69";
            ctx.lineWidth=5;
            ctx.beginPath();
            ctx.arc(explosion.x,explosion.y,explosion.radius,0,TAU);
            ctx.stroke();
            ctx.restore();
        });
        this.particles.forEach(particle=>particle.draw());
        this.player.draw();
        this.damageTexts.forEach(text=>text.draw());
        ctx.restore();
        this.drawHud();
        if(this.flash>0){
            ctx.fillStyle=`rgba(255,70,90,${this.flash*.7})`;
            ctx.fillRect(0,0,W,H);
        }
    }

    loop(timestamp){
        const rawDt=Math.min(.05,(timestamp-this.lastTime)/1000||0);
        this.lastTime=timestamp;
        if(this.state==="playing"){
            this.accumulator+=rawDt;
            let steps=0;
            while(this.accumulator>=this.fixedStep&&steps<7){
                this.update(this.fixedStep);
                this.accumulator-=this.fixedStep;
                steps++;
            }
        }
        this.draw();
        input.endFrame();
        requestAnimationFrame(time=>this.loop(time));
    }
}

const sound=new SoundSystem();
const input=new Input();
const game=new Game();
