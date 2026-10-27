# Executed in build_musashi globals. Both blades are rigid skinned to hand bones.
from mathutils import Matrix
weapon_objects=[]
def katana(side,s,length,theme):
 anchor=Vector((.90418 if s==1 else -.92585,.0491,1.82825));bone=side+'Hand'
 def tr(p):
  # canonical (width,thickness,longitudinal); handle is centred in hand.
  x,y,z=p;return anchor+Vector((y,-z,x))
 def wm(name,vs,fs,ma,bev=0,smooth=False):
  o=mesh(side+' katana • '+name,[tr(v) for v in vs],fs,ma,bone,bev=bev,smooth=smooth);weapon_objects.append(o);return o
 def wt(name,pts,rad,ma,sides=8):
  o=tube(side+' katana • '+name,[tr(v) for v in pts],rad,ma,bone,sides);weapon_objects.append(o);return o
 # Continuous shinogi and edge facets, curved profile and proper pointed kissaki.
 vs=[];n=58
 for i in range(n+1):
  t=i/n;z=.145+t*length;center=.075*t*t;w=.018*(1-.28*t)*(min(1,(1-t)*12) if t>.91 else 1)
  vs.extend([(center-w,0,z),(center-.003,-.0055,z),(center+w,0,z),(center-.003,.0055,z)])
 fs=[(i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j) for i in range(n) for j in range(4)]+[(3,2,1,0)]
 blade=wm('curved shinogi-zukuri blade',vs,fs,silver);blade.data.materials.append(edge)
 for p in blade.data.polygons:p.material_index=0 if p.index%4 in [0,3] else 1
 # Visible hamon line along blade on both flats, subtle warm steel.
 for sy in [-1,1]:
  pts=[]
  for i in range(121):
   t=i/120;pts.append((.075*t*t+.009*(1-.28*t)+.0014*math.sin(t*75),sy*.0018,.145+t*length*.94))
  wt('undulating temper line',pts,.0005,edge,5)
 # Habaki brass collar.
 for z0,z1,ww,dd,ma,name in [(.105,.151,.022,.009,gold,'brass habaki'),(-.13,-.113,.023,.014,gold,'kashira pommel'),(.082,.103,.025,.014,gold,'fuchi ferrule')]:
  vs=[(x,y,z) for z in [z0,z1] for x,y in [(-ww,-dd),(ww,-dd),(ww,dd),(-ww,dd)]]
  wm(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],ma,.0012)
 # Curved four-lobed dark tsuba with golden outer edge, cut-out-style inlays.
 pts=[]
 for i in range(81):
  a=i*2*math.pi/80;r=.048+.008*math.cos(a*4);pts.append((r*math.cos(a),r*.73*math.sin(a),.103))
 vs=[(x,y,z+dz) for dz in [-.003,.003] for x,y,z in pts[:-1]];nn=80
 wm('sculpted quatrefoil tsuba',vs,[tuple(range(nn-1,-1,-1)),tuple(range(nn,nn*2))]+[(i,(i+1)%nn,(i+1)%nn+nn,i+nn) for i in range(nn)],black,.0008)
 wt('gold tsuba contour',pts,.0012,gold)
 for a in [0,math.pi/2,math.pi,math.pi*1.5]:
  wt('tsuba chased scroll',[(.032*math.cos(a)+.010*math.cos(t),.025*math.sin(a)+.007*math.sin(t),.107) for t in [i*2*math.pi/24 for i in range(25)]],.0009,gold)
 # Elliptic tsuka wrapped in crisscross strips, exposed diamond samegawa.
 vs=[]
 for j in range(13):
  z=-.116+j/12*.20;r=.020-.002*math.sin(j/12*math.pi)
  for i in range(24):a=i*2*math.pi/24;vs.append((r*math.cos(a),r*.63*math.sin(a),z))
 fs=[(j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i) for j in range(12) for i in range(24)]
 wm('ray-skin grip',vs,fs,theme,smooth=True)
 for sign in [-1,1]:
  pts=[]
  for i in range(241):
   t=i/240;a=sign*t*2*math.pi*7;rr=.0205-.002*math.sin(t*math.pi);pts.append((rr*math.cos(a),rr*.66*math.sin(a),-.113+t*.195))
  wt('interlaced silk tsukamaki',pts,.0027,black)
 # Gold menuki pin and seal flourish set into grip face.
 for sy in [-1,1]:
  wt('grip gold menuki',[(.004*math.sin(t),sy*.014,-.025+.017*math.cos(t)) for t in [i*2*math.pi/32 for i in range(33)]],.0014,gold)
 # Stable, explicit hand attachment point for gameplay replacement.
 e=bpy.data.objects.new('Attachment_'+side+'Hand_Katana',None);col.objects.link(e);e.empty_display_type='ARROWS';e.empty_display_size=.05;e.parent=arm;e.parent_type='BONE';e.parent_bone='mixamorig:'+bone
 bpy.context.view_layer.update();e.matrix_world=Matrix.Translation(anchor);e['attachment_role']='Rigid hand socket; sword bound to same hand bone. Rest world transform documented.'
 return anchor
katana('Right',-1,1.14,blue)
katana('Left',1,.98,red)
# Hip scabbards: one deep blue, one lacquer-red, full tapered curvature.
for j,ma in enumerate([blue,red]):
 start=Vector((.213+j*.035,.036,1.39-j*.04));axis=Vector((.13,.82,-.46)).normalized();xx=Vector((1,0,0));yy=axis.cross(xx).normalized()
 pts=[];n=48;vs=[];length=.94-j*.1
 for i in range(n+1):
  t=i/n;center=start+axis*t*length+xx*.045*t*t;pts.append(center);r=.023*(1-.12*t)*min(1,(1-t)*18+.10)
  for k in range(16):a=k*2*math.pi/16;vs.append(center+xx*r*math.cos(a)+yy*r*.64*math.sin(a))
 fs=[(i*16+k,i*16+(k+1)%16,(i+1)*16+(k+1)%16,(i+1)*16+k) for i in range(n) for k in range(16)]+[tuple(range(15,-1,-1)),tuple(n*16+k for k in range(16))]
 mesh('Saya '+str(j+1)+' • curved lacquered sheath',vs,fs,ma,'Hips',bev=.001)
 for t in [.015,.11,.96]:
  center=start+axis*t*length+xx*.045*t*t;rad=.024*(1-.12*t);tube('Saya • chased gold throat and kojiri',[center+xx*rad*math.cos(a)+yy*rad*.66*math.sin(a) for a in [i*2*math.pi/40 for i in range(41)]],.0025,gold,'Hips')
 for k in range(4):
  z=1.35-k*.014;curve('Saya • braided suspension',[ (.18,-.07,z),(.29,-.015,z-.035),(.29,.10,z-.06)],.0025,black,'Hips')
