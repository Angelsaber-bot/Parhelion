"""Original baked skeletal clips. Source Blender world: Z up, -Y forward.

build() changes only animation/pose on the loaded rig, never mesh data. All IK is
solved analytically and baked; runtime needs no constraints or Blender drivers.
"""
import bpy, math, json
from mathutils import Vector, Quaternion, Matrix
FPS=30
CLIPS={'Idle':90,'Walk':32,'Run':20,'Attack':48}

def build():
    arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    sc=bpy.context.scene;sc.render.fps=FPS;sc.render.fps_base=1
    arm.animation_data_clear();arm.animation_data_create()
    for n in CLIPS:
        a=bpy.data.actions.get(n)
        if a:bpy.data.actions.remove(a,do_unlink=True)
    rest={b.name:arm.matrix_world@b.matrix_local for b in arm.data.bones}
    relative={b.name:(b.parent.matrix_local.inverted()@b.matrix_local if b.parent else b.matrix_local.copy()) for b in arm.data.bones}
    cache={};violations=[]
    def nm(n):return n if n.startswith(('Runtime','mixamorig:')) else 'mixamorig:'+n
    def reset():
        for p in arm.pose.bones:
            p.rotation_mode='QUATERNION';p.location=(0,0,0);p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
        cache.clear()
    def world(n):
        n=nm(n)
        if n in cache:return cache[n]
        p=arm.pose.bones[n]
        base=world(p.parent.name)@relative[n] if p.parent else arm.matrix_world@relative[n]
        cache[n]=base@p.matrix_basis
        return cache[n]
    def setworld(n,pos,rot):
        n=nm(n);p=arm.pose.bones[n];base=world(p.parent.name)@relative[n] if p.parent else arm.matrix_world@relative[n]
        desired=Matrix.LocRotScale(Vector(pos),rot,Vector((1,1,1)));local=base.inverted()@desired;loc,q,s=local.decompose();p.location=loc;p.rotation_quaternion=q;p.scale=(1,1,1);cache.clear()
    def local_world_axis(n,axis,angle):
        n=nm(n);p=arm.pose.bones[n];axislocal=rest[n].to_quaternion().inverted()@Vector(axis);p.rotation_quaternion=Quaternion(axislocal,angle);cache.clear()
    def swing_rest(n,pos,target):
        n=nm(n);old=(rest[n].to_3x3()@Vector((0,1,0))).normalized();new=(Vector(target)-Vector(pos)).normalized();q=old.rotation_difference(new)@rest[n].to_quaternion();setworld(n,pos,q);return q
    def solve_two(upper,lower,target,pole,clip,frame):
        un=nm(upper);ln=nm(lower);hip=world(un).translation.copy();l1=arm.data.bones[un].length;l2=arm.data.bones[ln].length
        end=Vector(target);delta=end-hip;distance=delta.length;limit=l1+l2-.0001
        if distance>limit:
            if distance-limit>.0005:violations.append({'clip':clip,'frame':frame,'chain':upper,'overreach_m':round(distance-limit,6)})
            end=hip+delta.normalized()*limit;delta=end-hip;distance=limit
        d=delta.normalized();bend=Vector(pole)-d*Vector(pole).dot(d)
        if bend.length<.001:bend=Vector((0,-1,0))-d*d.y
        bend.normalize();along=(l1*l1-l2*l2+distance*distance)/(2*distance);height=math.sqrt(max(0,l1*l1-along*along));knee=hip+d*along+bend*height
        swing_rest(un,hip,knee);q=swing_rest(ln,knee,end)
        return end,q
    def smooth(t):t=max(0,min(1,t));return t*t*(3-2*t)
    def foot_path(phase,period,speed,duty,lift):
        stride=period*speed;extent=stride*duty*.5
        if phase<duty:return -extent+stride*phase,0.0,True
        t=(phase-duty)/(1-duty);m=stride*(1-duty)
        y=(2*t**3-3*t*t+1)*extent+(-2*t**3+3*t*t)*(-extent)+(t**3-2*t*t+t)*m+(t**3-t*t)*m
        return y,lift*math.sin(math.pi*t)**2,False
    # Right-hand local Z follows the handle/blade, Y follows metacarpals.
    grip_base=Matrix(((-1,0,0),(0,-1,0),(0,0,1))).to_quaternion()
    params={'Walk':{'speed':1.04,'duty':.60,'lift':.060,'hip_drop':.066,'bob':.007},'Run':{'speed':2.78,'duty':.36,'lift':.105,'hip_drop':.088,'bob':.018}}
    metadata={'fps':FPS,'source_axes':{'up':'+Z','forward':'-Y'},'in_place':True,'ik':'analytical two-bone solution baked every frame; no live constraints','grip':{'bones':['mixamorig:RightHand','mixamorig:LeftHand'],'blade_axis_rest_world':[0,-1,0],'handle_center_local':[-.012,.055,0]},'clips':{},'cloth_secondary_motion':'shared small rotation only, not physical simulation'}
    idle_start={}
    for clip,intervals in CLIPS.items():
        action=bpy.data.actions.new(clip);action.use_fake_user=True;arm.animation_data.action=action;duration=intervals/FPS;all_keyed=[];previous_quaternions={}
        for k in range(intervals+1):
            frame=k+1;t=k/intervals
            # Exact periodic endpoints, including quaternion sign.
            phase=0.0 if k==intervals and clip!='Attack' else t
            reset();hipdelta=Vector((0,0,-.025));hipyaw=0;lean=0;twist=0
            if clip=='Idle':
                hipdelta.x=.002*math.sin(2*math.pi*phase);hipdelta.z+=.003*math.sin(2*math.pi*phase);lean=.004*math.sin(2*math.pi*phase)
            elif clip in params:
                p=params[clip];hipdelta=Vector(((.006 if clip=='Run' else .008)*math.sin(2*math.pi*phase),0,-p['hip_drop']+p['bob']*math.cos(4*math.pi*phase)));hipyaw=.018*math.sin(2*math.pi*phase);lean=.07 if clip=='Run' else .018;twist=-.025*math.sin(2*math.pi*phase)
            elif clip=='Attack':
                # Idle -> anticipatory load -> contact at20/36 -> follow-through -> Idle.
                attack_points=[(0,0),(.28,1),(.556,-.75),(.72,-.35),(1,0)]
                value=0
                for (a,x),(b,y) in zip(attack_points,attack_points[1:]):
                    if a<=t<=b:value=x+(y-x)*smooth((t-a)/(b-a));break
                hipdelta.z-=.035*math.sin(math.pi*t)**2;hipdelta.y-=.08*math.sin(math.pi*t)**2;hipyaw=.11*value;twist=.22*value;lean=.035*math.sin(math.pi*t)
            hip=rest[nm('Hips')];setworld('Hips',hip.translation+hipdelta,Quaternion((0,0,1),hipyaw)@hip.to_quaternion())
            local_world_axis('Spine',(1,0,0),lean*.35);local_world_axis('Spine1',(1,0,0),lean*.4);local_world_axis('Spine2',(0,0,1),twist)
            if clip=='Idle':local_world_axis('Head',(0,0,1),.012*math.sin(2*math.pi*phase))
            for label,offset in [('Left',0),('Right',.5)]:
                ankle=rest[nm(label+'Foot')].translation.copy()
                if clip in params:
                    p=params[clip];y,z,contact=foot_path((phase+offset)%1,duration,p['speed'],p['duty'],p['lift']);ankle.y+=y;ankle.z+=z
                # Analytic ankle target keeps both soles flat; no toe penetration from pitch.
                solved,_=solve_two(label+'UpLeg',label+'Leg',ankle,(0,-1,0),clip,frame)
                setworld(label+'Foot',solved,rest[nm(label+'Foot')].to_quaternion())
            # Authored two-sword combat carry and independently timed cross-cut combo.
            targets={'Left':Vector((.36,-.13,1.29)),'Right':Vector((-.40,-.18,1.50))}
            wrist_angles={'Left':(.65,-1.05),'Right':(-.40,-.16)}
            if clip=='Idle':
                for label in targets: targets[label].z+=.004*math.sin(2*math.pi*phase)
            elif clip in params:
                amp=.065 if clip=='Run' else .045
                targets['Left'].y+=amp*math.cos(2*math.pi*phase)
                targets['Right'].y-=amp*math.cos(2*math.pi*phase)
                for label in targets:targets[label].z+=.055 if clip=='Run' else 0
            elif clip=='Attack':
                sequences={
                  'Right':[(0,(-.40,-.18,1.50),(-.40,-.16)),(.20,(-.47,.02,2.08),(-1.05,-.18)),(.40,(.07,-.44,1.52),(.64,.42)),(.57,(-.42,-.20,1.33),(.26,-.30)),(1,(-.40,-.18,1.50),(-.40,-.16))],
                  'Left':[(0,(.36,-.13,1.29),(.65,-1.05)),(.29,(.43,-.14,1.58),(-.62,.10)),(.47,(.47,.02,2.02),(-1.12,.22)),(.69,(-.04,-.44,1.48),(.66,-.40)),(.83,(.39,-.21,1.33),(.25,.25)),(1,(.36,-.13,1.29),(.65,-1.05))]}
                for label,keys in sequences.items():
                    for (ta,pa,aa),(tb,pb,ab) in zip(keys,keys[1:]):
                        if ta<=t<=tb:
                            f=smooth((t-ta)/(tb-ta));targets[label]=Vector(pa).lerp(Vector(pb),f);wrist_angles[label]=tuple(aa[i]+(ab[i]-aa[i])*f for i in range(2));break
            for label in ['Left','Right']:
                sign=1 if label=='Left' else -1;target,qfore=solve_two(label+'Arm',label+'ForeArm',targets[label],(sign,.20,-.25),clip,frame)
                ax,az=wrist_angles[label]
                handq=Quaternion((0,0,1),az)@Quaternion((1,0,0),ax)@Quaternion((0,1,0),math.radians(65*sign))@rest[nm(label+'Hand')].to_quaternion()
                setworld(label+'Hand',target,handq)
                for finger in ['Index','Middle','Ring','Pinky']:
                    for part in range(1,4):
                        n=nm(label+'Hand'+finger+str(part))
                        if n not in arm.pose.bones:continue
                        bone=arm.data.bones[n];direction=(arm.matrix_world.to_3x3()@(bone.tail_local-bone.head_local)).normalized();axis=Vector((0,0,1)).cross(direction).normalized();angle=([-35,-45,-20] if finger=='Thumb' else [55,78,60])[part-1]
                        local_world_axis(n,axis,math.radians(angle))
                        if finger=='Thumb' and part==1:
                            p=arm.pose.bones[n];p.rotation_quaternion=Quaternion(rest[n].to_quaternion().inverted()@Vector((0,0,1)),sign*.45)@p.rotation_quaternion;cache.clear()
                # Thumb opposition follows a measured path around the tsuka, rather than
                # guessing a flexion axis shared with the four parallel fingers.
                gx=.90418 if label=='Left' else .92585
                hand_deform=world(label+'Hand')@rest[nm(label+'Hand')].inverted()
                thumb_targets=[(sign*.878,.027,1.815),(sign*(gx-.008),.043,1.803),(sign*(gx+.010),.064,1.822)]
                for part,target_rest in enumerate(thumb_targets,1):
                    tn=nm(label+'HandThumb'+str(part));start=world(tn).translation.copy();swing_rest(tn,start,hand_deform@Vector(target_rest))
            # Same-phase secondary cloth tilt avoids inter-layer differential shearing.
            sway=0.0;cloth_forward=0.0
            if clip=='Idle':sway=math.radians(.35)*math.sin(2*math.pi*phase)
            elif clip in params:
                sway=math.radians(1.1 if clip=='Walk' else 1.6)*math.sin(2*math.pi*phase);cloth_forward=math.radians(.65 if clip=='Walk' else 1.0)*math.sin(4*math.pi*phase)
            elif clip=='Attack':sway=math.radians(1.4)*math.sin(2*math.pi*t)*math.sin(math.pi*t)
            for name in ['RuntimeSkirtFront','RuntimeSkirtBack','RuntimeSkirtLeft','RuntimeSkirtRight']:
                if name in arm.pose.bones:
                    p=arm.pose.bones[name];qrest=rest[name].to_quaternion();qx=Quaternion(qrest.inverted()@Vector((1,0,0)),cloth_forward);qy=Quaternion(qrest.inverted()@Vector((0,1,0)),sway);p.rotation_quaternion=qy@qx;cache.clear()
            if clip=='Attack' and k in (0,intervals):
                for p in arm.pose.bones:
                    loc,q,s=idle_start[p.name];p.location=loc;p.rotation_quaternion=q;p.scale=s
            for p in arm.pose.bones:
                q=p.rotation_quaternion.copy()
                if p.name in previous_quaternions and q.dot(previous_quaternions[p.name])<0:q.negate();p.rotation_quaternion=q
                previous_quaternions[p.name]=q.copy()
                p.keyframe_insert('location',frame=frame,group=p.name);p.keyframe_insert('rotation_quaternion',frame=frame,group=p.name);p.keyframe_insert('scale',frame=frame,group=p.name)
            if clip=='Idle' and k==0:idle_start={p.name:(p.location.copy(),p.rotation_quaternion.copy(),p.scale.copy()) for p in arm.pose.bones}
        for fc in action.fcurves:
            for key in fc.keyframe_points:key.interpolation='LINEAR'
        action['original_authored']=True;action['loop']=clip!='Attack';action['duration_seconds']=duration
        info={'frame_start':1,'frame_end':intervals+1,'duration':duration,'loop':clip!='Attack','in_place':True,'nominal_speed_source_mps':params.get(clip,{}).get('speed',0),'representative_frames':sorted(set([1,1+intervals//4,1+intervals//2,1+3*intervals//4,1+intervals]))}
        if clip in params:
            p=params[clip];info.update({'full_cycle_stride_source_m':p['speed']*duration,'stance_duty':p['duty'],'left_phase_offset':0,'right_phase_offset':.5,'phase_formula':'((frame-1)/cycle_intervals + foot_phase_offset) % 1; stance when phase < duty','stance_relative_ankle_y_velocity_mps':p['speed'],'runtime_forward_velocity_source':[0,-p['speed'],0],'swing_clearance_source_m':p['lift']})
        if clip=='Attack':info.update({'contact_frames':[20,34],'contact_times':[19/FPS,33/FPS],'contact_fractions':[.40,.69],'idle_matching_endpoints':True})
        metadata['clips'][clip]=info
        track=arm.animation_data.nla_tracks.new();track.name=clip;strip=track.strips.new(clip,1,action);strip.name=clip;track.mute=True
    metadata['reach_clamps']=violations
    metadata['nla_note']='Four muted named NLA tracks retained as action references; export all named Actions (ACTIONS mode). Muted to avoid stacking during active-action preview.'
    arm.animation_data.action=bpy.data.actions.get('Idle');sc.frame_start=1;sc.frame_end=91;sc.frame_set(1);bpy.context.view_layer.update();arm['RuntimeAnimationMetadata']=json.dumps(metadata)
    return metadata
