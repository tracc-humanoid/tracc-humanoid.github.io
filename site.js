(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setIcon(button, id) {
    var use = button.querySelector("use");
    if (use) use.setAttribute("href", "#" + id);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    var minutes = Math.floor(seconds / 60);
    var remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
    return minutes + ":" + remainder;
  }

  var videoPlayers = Array.from(document.querySelectorAll("[data-player]"));
  videoPlayers.forEach(function (player) {
    var video = player.querySelector("video");
    var toggle = player.querySelector("[data-video-toggle]");
    var mute = player.querySelector("[data-video-mute]");
    var fullscreen = player.querySelector("[data-video-fullscreen]");
    var seek = player.querySelector("[data-video-seek]");
    var time = player.querySelector("[data-video-time]");

    function syncPlayback() {
      var paused = video.paused;
      player.classList.toggle("is-paused", paused);
      setIcon(toggle, paused ? "icon-play" : "icon-pause");
      toggle.setAttribute("aria-label", paused ? "Play video" : "Pause video");
    }

    function syncTime() {
      var duration = Number.isFinite(video.duration) ? video.duration : 0;
      seek.max = duration || 100;
      seek.value = duration ? video.currentTime : 0;
      time.textContent = formatTime(video.currentTime);
    }

    function togglePlayback() {
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    }

    toggle.addEventListener("click", togglePlayback);
    video.addEventListener("click", togglePlayback);
    video.addEventListener("play", syncPlayback);
    video.addEventListener("pause", syncPlayback);
    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("loadedmetadata", function () {
      syncTime();
      if (video.currentTime === 0) video.currentTime = .001;
    });

    seek.addEventListener("input", function () {
      video.currentTime = Number(seek.value);
      syncTime();
    });

    mute.addEventListener("click", function () {
      video.muted = !video.muted;
      setIcon(mute, video.muted ? "icon-muted" : "icon-volume");
      mute.setAttribute("aria-label", video.muted ? "Unmute video" : "Mute video");
    });

    fullscreen.addEventListener("click", function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (player.requestFullscreen) player.requestFullscreen();
    });

    syncPlayback();
    syncTime();
  });

  if ("IntersectionObserver" in window) {
    var videoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target.querySelector("video");
        if (!entry.isIntersecting) video.pause();
        else if (!reduceMotion) {
          video.play().catch(function () {});
        }
      });
    }, { threshold: .35 });
    videoPlayers.forEach(function (player) { videoObserver.observe(player); });
  }

  var framePlayer = document.querySelector("[data-frame-player]");
  if (framePlayer) {
    var frameImage = framePlayer.querySelector("img");
    var frameToggle = framePlayer.querySelector("[data-frame-toggle]");
    var frameSeek = framePlayer.querySelector("[data-frame-seek]");
    var framePrefix = framePlayer.dataset.prefix;
    var frameCount = Number(framePlayer.dataset.count);
    var frameFps = Number(framePlayer.dataset.fps);
    var frameCache = new Map();
    var currentFrame = 0;
    var requestedFrame = 0;
    var framePlaying = !reduceMotion;
    var frameActive = !("IntersectionObserver" in window);
    var cacheQueued = false;
    var lastFrameTime = performance.now();

    function frameUrl(index) {
      return framePrefix + String(index).padStart(4, "0") + ".webp";
    }

    function loadFrame(index) {
      if (!frameCache.has(index)) {
        var image = new Image();
        image.decoding = "async";
        image.src = frameUrl(index);
        frameCache.set(index, image);
      }
      return frameCache.get(index);
    }

    function syncFrameButton() {
      setIcon(frameToggle, framePlaying ? "icon-pause" : "icon-play");
      frameToggle.setAttribute("aria-label", framePlaying ? "Pause frame sequence" : "Play frame sequence");
    }

    function renderFrame(index) {
      index = Math.max(0, Math.min(frameCount - 1, index));
      requestedFrame = index;
      currentFrame = index;
      frameSeek.value = index;

      var image = loadFrame(index);
      if (image.complete) frameImage.src = image.src;
      else image.addEventListener("load", function () {
        if (requestedFrame === index) frameImage.src = image.src;
      }, { once: true });

      for (var offset = 1; offset <= 12; offset += 1) loadFrame((index + offset) % frameCount);
    }

    frameToggle.addEventListener("click", function () {
      framePlaying = !framePlaying;
      lastFrameTime = performance.now();
      syncFrameButton();
    });

    frameSeek.addEventListener("input", function () {
      framePlaying = false;
      syncFrameButton();
      renderFrame(Number(frameSeek.value));
    });

    function animateFrames(now) {
      if (framePlaying && frameActive && document.visibilityState === "visible") {
        var elapsed = now - lastFrameTime;
        var stepMs = 1000 / frameFps;
        if (elapsed >= stepMs) {
          var advance = Math.max(1, Math.floor(elapsed / stepMs));
          renderFrame((currentFrame + advance) % frameCount);
          lastFrameTime = now;
        }
      } else {
        lastFrameTime = now;
      }
      requestAnimationFrame(animateFrames);
    }

    renderFrame(0);
    syncFrameButton();
    requestAnimationFrame(animateFrames);

    function fillCache() {
      for (var index = 0; index < frameCount; index += 1) loadFrame(index);
    }

    if ("IntersectionObserver" in window) {
      var frameObserver = new IntersectionObserver(function (entries) {
        frameActive = entries[0].isIntersecting;
        lastFrameTime = performance.now();
        if (frameActive && !cacheQueued) {
          cacheQueued = true;
          if ("requestIdleCallback" in window) window.requestIdleCallback(fillCache, { timeout: 1800 });
          else window.setTimeout(fillCache, 400);
        }
      }, { rootMargin: "300px 0px", threshold: 0 });
      frameObserver.observe(framePlayer);
    } else {
      fillCache();
    }

    console.assert(frameCount === 143, "TRACC ablation frame manifest changed");
  }

  var rewards = {
    "box-jump": {
      file: "reward_box_jump.py",
      code: `REWARD_TERM_NAMES = (
    'both_feet_inside_contact', 'pelvis_xy_margin', 'height_match',
    'upright', 'no_slip_no_penetration', 'calm'
)


def _xy_outside_distance(state, body_name, goal_name):
    centre = state.goal(goal_name)
    half = 0.5 * state.goal_size[goal_name]
    body = state.body(body_name)
    dx = torch.abs(body[:, 0] - centre[:, 0]) - half[:, 0]
    dy = torch.abs(body[:, 1] - centre[:, 1]) - half[:, 1]
    dx = torch.clamp(dx, min=0.0)
    dy = torch.clamp(dy, min=0.0)
    return torch.sqrt(dx * dx + dy * dy)


def reward_terms(state):
    dl = state.edge_distance('left_foot', 'box_top')
    dr = state.edge_distance('right_foot', 'box_top')
    cl = state.in_contact('left_foot').float()
    cr = state.in_contact('right_foot').float()
    left_inside = torch.exp(-25.0 * dl) * cl
    right_inside = torch.exp(-25.0 * dr) * cr
    both_inside = torch.minimum(left_inside, right_inside)

    # Encourage pelvis XY to be comfortably inside the support footprint
    xy_out = _xy_outside_distance(state, 'pelvis', 'box_top')
    pelvis_xy_margin = torch.clamp(1.0 - xy_out / 0.10, 0.0, 1.0)

    pelvis_z = state.body('pelvis')[:, 2]
    target_z = state.goal('box_top')[:, 2] + 0.80
    height = torch.clamp(torch.exp(-torch.abs(pelvis_z - target_z) / 0.12), 0.0, 1.0)

    upright = torch.clamp(state.upright, 0.0, 1.0)

    no_slip = torch.exp(-state.slip)
    no_pen = torch.exp(-5.0 * state.penetration)
    integrity = torch.clamp(no_slip * no_pen, 0.0, 1.0)

    speed = torch.linalg.vector_norm(state.root_lin_vel, dim=-1)
    ang = torch.linalg.vector_norm(state.root_ang_vel, dim=-1)
    calm = torch.exp(-speed / 0.9) * torch.exp(-ang / 1.8)

    return {
        'both_feet_inside_contact': torch.clamp(both_inside, 0.0, 1.0),
        'pelvis_xy_margin': pelvis_xy_margin,
        'height_match': height,
        'upright': upright,
        'no_slip_no_penetration': integrity,
        'calm': torch.clamp(calm, 0.0, 1.0),
    }


def reward(state):
    t = reward_terms(state)
    r = (
        0.36 * t['both_feet_inside_contact'] +
        0.20 * t['height_match'] +
        0.16 * t['upright'] +
        0.16 * t['pelvis_xy_margin'] +
        0.12 * t['no_slip_no_penetration'] +
        0.12 * t['calm']
    )
    return torch.clamp(r, 0.0, 1.0)

# Shared success/failure/termination

def success(state):
    dl = state.edge_distance('left_foot', 'box_top')
    dr = state.edge_distance('right_foot', 'box_top')
    left_supported = (dl < 0.06) & state.in_contact('left_foot')
    right_supported = (dr < 0.06) & state.in_contact('right_foot')
    feet_supported = left_supported & right_supported
    pelvis_z = state.body('pelvis')[:, 2]
    target_z = state.goal('box_top')[:, 2] + 0.80
    height_ok = torch.abs(pelvis_z - target_z) < 0.12
    upright_ok = state.upright >= 0.8
    speed_ok = torch.linalg.vector_norm(state.root_lin_vel, dim=-1) < 1.0
    ang_ok = torch.linalg.vector_norm(state.root_ang_vel, dim=-1) < 2.0
    return feet_supported & height_ok & upright_ok & speed_ok & ang_ok


def failure(state):
    return state.fallen


def termination(state):
    return state.fallen`
    },
    "log-walk": {
      file: "reward_log_walk.py",
      code: `REWARD_TERM_NAMES = (
    'progress_to_end_on_log',
    'contact_on_log_top',
    'pelvis_height_on_log',
    'upright_on_log',
    'near_top_missing_contact_cost'
)

# Helpers
def _xy_inside_goal(state, body_role, goal_name):
    p = state.body(body_role)
    g = state.goal(goal_name)
    half = 0.5 * state.goal_size[goal_name]
    dx = torch.abs(p[:, 0] - g[:, 0])
    dy = torch.abs(p[:, 1] - g[:, 1])
    inside = (dx <= half[:, 0]) & (dy <= half[:, 1])
    return inside.float()

def _clamp01(x):
    return torch.clamp(x, 0.0, 1.0)

def success(state):
    g = state.goal('log_end')
    half = 0.5 * state.goal_size['log_end']
    lf = state.body('left_foot')
    rf = state.body('right_foot')
    dx_l = torch.abs(lf[:,0]-g[:,0]); dy_l = torch.abs(lf[:,1]-g[:,1])
    dx_r = torch.abs(rf[:,0]-g[:,0]); dy_r = torch.abs(rf[:,1]-g[:,1])
    left_in = (dx_l <= half[:,0]) & (dy_l <= half[:,1])
    right_in = (dx_r <= half[:,0]) & (dy_r <= half[:,1])
    feet_in = left_in & right_in
    feet_contact = state.in_contact('left_foot') & state.in_contact('right_foot')
    pelvis = state.body('pelvis')
    pelvis_ok = torch.abs(pelvis[:,2] - (g[:,2] + 0.80)) <= 0.12
    upright_ok = state.upright >= 0.75
    lin_ok = torch.linalg.vector_norm(state.root_lin_vel, dim=-1) <= 0.45
    ang_ok = torch.linalg.vector_norm(state.root_ang_vel, dim=-1) <= 1.0
    return (feet_in & feet_contact & pelvis_ok & upright_ok & lin_ok & ang_ok)

def failure(state):
    return state.fallen

def termination(state):
    return failure(state)

# Dense shaping
def reward_terms(state):
    # On-log membership masks
    l_on = _xy_inside_goal(state, 'left_foot', 'log_top')
    r_on = _xy_inside_goal(state, 'right_foot', 'log_top')
    both_on = l_on * r_on

    # Target-conditioned foot contact on the log top
    l_contact = state.in_contact('left_foot').float() * l_on
    r_contact = state.in_contact('right_foot').float() * r_on
    contact_on_log_top = 0.5 * (l_contact + r_contact)

    # Forward progress only counts while staying on the log
    dist_end = state.edge_distance('pelvis', 'log_end')
    progress_to_end = torch.exp(-3.0 * dist_end) * both_on

    # Pelvis height consistent with standing on the log while traversing
    top_z = state.goal('log_top')[:, 2]
    pelvis_z = state.body('pelvis')[:, 2]
    height_err = torch.abs(pelvis_z - (top_z + 0.80))
    pelvis_height = torch.exp(-8.0 * height_err) * both_on

    # Mild upright shaping while on the log
    upright_on_log = _clamp01(state.upright) * both_on

    # Bounded near-top but missing-contact cost: encourages real support
    # Proximity to the log top for each foot using edge distance (3D to box)
    l_prox = torch.exp(-10.0 * state.edge_distance('left_foot', 'log_top'))
    r_prox = torch.exp(-10.0 * state.edge_distance('right_foot', 'log_top'))
    miss_contact = 0.5 * (l_prox * (1.0 - state.in_contact('left_foot').float()) +
                          r_prox * (1.0 - state.in_contact('right_foot').float()))

    return {
        'progress_to_end_on_log': _clamp01(progress_to_end),
        'contact_on_log_top': _clamp01(contact_on_log_top),
        'pelvis_height_on_log': _clamp01(pelvis_height),
        'upright_on_log': _clamp01(upright_on_log),
        'near_top_missing_contact_cost': _clamp01(miss_contact)
    }

def reward(state):
    terms = reward_terms(state)
    # Positive weights emphasise target-conditioned progress and real contact
    r = (0.45 * terms['progress_to_end_on_log'] +
         0.30 * terms['contact_on_log_top'] +
         0.15 * terms['pelvis_height_on_log'] +
         0.10 * terms['upright_on_log'])
    # Subtract a small bounded cost for being near without contact
    r = r - 0.20 * terms['near_top_missing_contact_cost']
    return _clamp01(r)`
    },
    "kick-target": {
      file: "reward_kick_target.py",
      code: `REWARD_TERM_NAMES = (
    'approach_pad',
    'strike_captured',
    'stand_two_feet',
    'stand_height',
    'stand_stability',
    'no_fall',
)

def _approach(state):
    dL = torch.clamp(state.edge_distance('left_foot', 'pad_face') - 0.02, min=0.0)
    dR = torch.clamp(state.edge_distance('right_foot', 'pad_face') - 0.02, min=0.0)
    return torch.max(torch.exp(-6.0 * dL), torch.exp(-6.0 * dR))


def _height_score(state):
    pelvis_z = state.body('pelvis')[:, 2]
    ground_z = state.goal_pos['ground'][:, 2]
    return torch.clamp((pelvis_z - (ground_z + 0.70)) / 0.25, 0.0, 1.0)


def reward_terms(state):
    approach_pad = _approach(state)
    latched = state.task_latched.to(torch.float32)

    both = (state.in_contact('left_foot') & state.in_contact('right_foot')).to(torch.float32)
    upright = torch.clamp(state.upright, 0.0, 1.0)
    height = _height_score(state)

    lin = torch.linalg.vector_norm(state.root_lin_vel, dim=-1)
    ang = torch.linalg.vector_norm(state.root_ang_vel, dim=-1)
    stability = 0.5 * (torch.clamp(1.0 - lin / 0.35, 0.0, 1.0) + torch.clamp(1.0 - ang / 1.0, 0.0, 1.0))

    strike_captured = latched  # remembered discrete event
    stand_two_feet = latched * both
    stand_height = latched * height
    stand_stability = latched * (0.6 * stability + 0.4 * upright)
    no_fall = (~state.fallen).to(torch.float32)

    return {
        'approach_pad': approach_pad,
        'strike_captured': torch.clamp(strike_captured, 0.0, 1.0),
        'stand_two_feet': torch.clamp(stand_two_feet, 0.0, 1.0),
        'stand_height': torch.clamp(stand_height, 0.0, 1.0),
        'stand_stability': torch.clamp(stand_stability, 0.0, 1.0),
        'no_fall': torch.clamp(no_fall, 0.0, 1.0),
    }


def reward(state):
    t = reward_terms(state)
    r = (
        0.10 * t['approach_pad'] +
        0.30 * t['strike_captured'] +
        0.22 * t['stand_two_feet'] +
        0.18 * t['stand_height'] +
        0.15 * t['stand_stability'] +
        0.05 * t['no_fall']
    )
    return torch.clamp(r, 0.0, 1.0)


def success(state):
    latched = state.task_latched
    both_feet = state.in_contact('left_foot') & state.in_contact('right_foot')
    pelvis_z = state.body('pelvis')[:, 2]
    ground_z = state.goal_pos['ground'][:, 2]
    height_ok = pelvis_z >= (ground_z + 0.700)
    upright_ok = state.upright >= 0.800
    lin_ok = torch.linalg.vector_norm(state.root_lin_vel, dim=-1) <= 0.350
    ang_ok = torch.linalg.vector_norm(state.root_ang_vel, dim=-1) <= 1.000
    return latched & both_feet & height_ok & upright_ok & lin_ok & ang_ok


def failure(state):
    return state.fallen


def termination(state):
    return failure(state)`
    },
    "football": {
      file: "reward_football.py",
      code: `REWARD_TERM_NAMES = (
    'foot_to_ball_proximity',
    'target_contact',
    'ball_velocity_to_goal',
    'ball_goal_proximity',
    'upright_standing',
    'no_fall',
    'near_without_contact_cost',
)

def _ball_goal_edge_distance_xy(state):
    ball = state.object_pos['ball']
    goal = state.goal('goal_region')
    half = 0.5 * state.goal_size['goal_region']
    offset = ball - goal
    nearest = torch.stack([
        torch.clamp(offset[:, 0], -half[:, 0], half[:, 0]),
        torch.clamp(offset[:, 1], -half[:, 1], half[:, 1]),
        torch.zeros_like(offset[:, 2])
    ], dim=-1) + goal
    delta = nearest - ball
    return torch.linalg.vector_norm(delta[:, :2], dim=-1)


def _upright_standing_01(state):
    up = torch.clamp((state.upright - 0.60) / 0.40, 0.0, 1.0)
    pelvis_z = state.body('pelvis')[:, 2]
    ground_z = state.goal('ground')[:, 2]
    height01 = torch.clamp((pelvis_z - ground_z - 0.55) / 0.35, 0.0, 1.0)
    return 0.5 * up + 0.5 * height01


def reward_terms(state):
    # Pre-contact approach using edge distance to the ball's strike region (either foot)
    l_prox = torch.exp(-10.0 * torch.clamp(state.edge_distance('left_foot', 'ball_strike_region') - 0.02, min=0.0))
    r_prox = torch.exp(-10.0 * torch.clamp(state.edge_distance('right_foot', 'ball_strike_region') - 0.02, min=0.0))
    foot_to_ball_proximity = torch.maximum(l_prox, r_prox)

    # Target-conditioned contact quality
    l_load = torch.tanh(state.contact_magnitude('left_foot') / 50.0)
    r_load = torch.tanh(state.contact_magnitude('right_foot') / 50.0)
    target_contact = torch.maximum(l_prox * l_load, r_prox * r_load)

    # Ball progress toward goal
    dist_xy = _ball_goal_edge_distance_xy(state)
    ball_goal_proximity = torch.exp(-3.0 * dist_xy)

    ball_xy = state.object_pos['ball'][:, :2]
    goal_xy = state.goal('goal_region')[:, :2]
    to_goal = goal_xy - ball_xy
    to_goal_norm = torch.linalg.vector_norm(to_goal, dim=-1) + 1e-6
    dir_hat = to_goal / to_goal_norm.unsqueeze(-1)
    v_xy = state.object_lin_vel['ball'][:, :2]
    speed_toward = (v_xy * dir_hat).sum(dim=-1)
    ball_velocity_to_goal = torch.clamp(speed_toward, 0.0, 8.0) / 8.0

    upright_standing = _upright_standing_01(state)
    no_fall = (~state.fallen).float()

    # Explicit off-target cost: near the ball but without effective contact
    near_without_contact_cost = torch.clamp(foot_to_ball_proximity * (1.0 - torch.clamp(target_contact, 0.0, 1.0)), 0.0, 1.0)

    return {
        'foot_to_ball_proximity': foot_to_ball_proximity,
        'target_contact': torch.clamp(target_contact, 0.0, 1.0),
        'ball_velocity_to_goal': ball_velocity_to_goal,
        'ball_goal_proximity': ball_goal_proximity,
        'upright_standing': upright_standing,
        'no_fall': no_fall,
        'near_without_contact_cost': near_without_contact_cost,
    }


def reward(state):
    t = reward_terms(state)
    # Positive weights emphasize correct interaction and ball progress
    total = (
        0.12 * t['foot_to_ball_proximity'] +
        0.30 * t['target_contact'] +
        0.22 * t['ball_velocity_to_goal'] +
        0.18 * t['ball_goal_proximity'] +
        0.14 * t['upright_standing'] +
        0.04 * t['no_fall']
    )
    # Off-target penalty (kept small so approach still has pre-contact gradient)
    total = total - 0.10 * t['near_without_contact_cost']
    return torch.clamp(total, 0.0, 1.0)


def success(state):
    ball = state.object_pos['ball']
    goal = state.goal('goal_region')
    half = 0.5 * state.goal_size['goal_region']
    inside_xy = (torch.abs(ball[:, 0] - goal[:, 0]) <= half[:, 0]) & (torch.abs(ball[:, 1] - goal[:, 1]) <= half[:, 1])
    pelvis_z = state.body('pelvis')[:, 2]
    ground_z = state.goal('ground')[:, 2]
    height_ok = (pelvis_z - ground_z) >= 0.60
    upright_ok = state.upright >= 0.80
    return inside_xy & upright_ok & (~state.fallen) & height_ok


def failure(state):
    return state.fallen | (state.upright < 0.3)


def termination(state):
    # Do not include success; environment handles success hold/stop.
    return state.fallen`
    },
    "backflip": {
      file: "reward_backflip.py",
      code: `REWARD_TERM_NAMES = (
    'approach_avg', 'left_xy_contact', 'right_xy_contact',
    'pelvis_height_match', 'linear_settle', 'angular_settle', 'upright', 'inversion_latched'
)

def _xy_inside(state, role: str, goal: str):
    p = state.body(role)
    g = state.goal_pos[goal]
    half = 0.5 * state.goal_size[goal]
    dx = p[:, 0] - g[:, 0]
    dy = p[:, 1] - g[:, 1]
    return (torch.abs(dx) <= half[:, 0]) & (torch.abs(dy) <= half[:, 1])

def reward_terms(state):
    goal = 'flip_landing_region'
    lf_d = state.edge_distance('left_foot', goal)
    rf_d = state.edge_distance('right_foot', goal)
    # Dense approach in 3D (limited weight)
    left_approach = torch.exp(-4.0 * torch.clamp(lf_d - 0.02, min=0.0))
    right_approach = torch.exp(-4.0 * torch.clamp(rf_d - 0.02, min=0.0))
    approach_avg = 0.5 * (left_approach + right_approach)

    # XY-inside times near-mask and contact magnitude -> assigns contact to the correct target
    li = _xy_inside(state, 'left_foot', goal)
    ri = _xy_inside(state, 'right_foot', goal)
    lf_c = torch.tanh(state.contact_magnitude('left_foot') / 150.0)
    rf_c = torch.tanh(state.contact_magnitude('right_foot') / 150.0)
    left_xy_contact = li.to(torch.float32) * torch.clamp(1.0 - lf_d / 0.08, 0.0, 1.0) * lf_c
    right_xy_contact = ri.to(torch.float32) * torch.clamp(1.0 - rf_d / 0.08, 0.0, 1.0) * rf_c

    # Pelvis height at landing target
    pelvis_z = state.body('pelvis')[:, 2]
    target = state.goal_pos[goal][:, 2] + 0.80
    pelvis_height_match = torch.exp(- (torch.abs(pelvis_z - target) / 0.18) ** 2)

    # Motion absorption on support
    lin = torch.linalg.vector_norm(state.root_lin_vel, dim=-1)
    ang = torch.linalg.vector_norm(state.root_ang_vel, dim=-1)
    double = left_xy_contact * right_xy_contact
    linear_settle = double * torch.exp(-lin / 0.40)
    angular_settle = double * torch.exp(-ang / 0.80)

    upright = state.upright
    inversion_latched = state.task_latched.to(torch.float32)

    return {
        'approach_avg': approach_avg,
        'left_xy_contact': left_xy_contact,
        'right_xy_contact': right_xy_contact,
        'pelvis_height_match': pelvis_height_match,
        'linear_settle': linear_settle,
        'angular_settle': angular_settle,
        'upright': upright,
        'inversion_latched': inversion_latched,
    }


def reward(state):
    t = reward_terms(state)
    r = (
        0.08 * t['approach_avg'] +
        0.15 * t['left_xy_contact'] + 0.15 * t['right_xy_contact'] +
        0.18 * t['pelvis_height_match'] + 0.18 * t['linear_settle'] + 0.12 * t['angular_settle'] +
        0.09 * t['upright'] + 0.05 * t['inversion_latched']
    )
    return torch.clamp(r, 0.0, 1.0)


def _feet_inside_xy(state):
    li = _xy_inside(state, 'left_foot', 'flip_landing_region')
    ri = _xy_inside(state, 'right_foot', 'flip_landing_region')
    return li, ri

def success(state):
    goal = 'flip_landing_region'
    li, ri = _feet_inside_xy(state)
    both_contact = state.in_contact('left_foot') & state.in_contact('right_foot')
    pelvis_z = state.body('pelvis')[:, 2]
    target = state.goal_pos[goal][:, 2] + 0.80
    height_ok = torch.abs(pelvis_z - target) <= 0.12
    upright_ok = state.upright >= 0.80
    lin = torch.linalg.vector_norm(state.root_lin_vel, dim=-1)
    ang = torch.linalg.vector_norm(state.root_ang_vel, dim=-1)
    speed_ok = (lin <= 0.350) & (ang <= 1.000)
    inverted_before = state.task_latched
    return (li & ri & both_contact & height_ok & upright_ok & speed_ok & inverted_before)

def failure(state):
    goal = 'flip_landing_region'
    li, ri = _feet_inside_xy(state)
    good_feet = li & ri & state.in_contact('left_foot') & state.in_contact('right_foot')
    pelvis_z = state.body('pelvis')[:, 2]
    low = pelvis_z < (state.goal_pos[goal][:, 2] + 0.55)
    return ((~good_feet) & low) | state.fallen

def termination(state):
    return state.fallen | failure(state)`
    },
    "handstand": {
      file: "reward_handstand.py",
      code: `REWARD_TERM_NAMES = (
    'hands_approach', 'left_on_target', 'right_on_target', 'both_hands_on_target',
    'inversion_progress', 'feet_over_pelvis_progress', 'pelvis_height_match', 'settled'
)
    
  def _xy_inside(state, role: str, goal: str):
    p = state.body(role)
    g = state.goal(goal)
    sz = state.goal_size[goal]
    dx = torch.abs(p[:, 0] - g[:, 0]) <= (0.5 * sz[:, 0])
    dy = torch.abs(p[:, 1] - g[:, 1]) <= (0.5 * sz[:, 1])
    return torch.logical_and(dx, dy).to(p.dtype)

def _hand_approach(state, role: str, goal: str):
    d = state.edge_distance(role, goal)
    return torch.exp(-6.0 * torch.clamp(d - 0.02, min=0.0))

def _bounded_contact(state, role: str):
    return torch.clamp(state.contact_magnitude(role) / 80.0, 0.0, 1.0)

def _up_dot_world_z(state):
    q = state.root_quat
    x, y = q[:, 0], q[:, 1]
    return 1.0 - 2.0 * (x * x + y * y)

def success(state):
    goal = 'hand_support_region'
    lh_xy = _xy_inside(state, 'left_hand', goal) > 0.5
    rh_xy = _xy_inside(state, 'right_hand', goal) > 0.5
    lh_c = state.in_contact('left_hand')
    rh_c = state.in_contact('right_hand')
    hands_ok = (lh_xy & lh_c) & (rh_xy & rh_c)

    pelvis_z = state.body('pelvis')[:, 2]
    goal_z = state.goal(goal)[:, 2]
    pelvis_ok = torch.abs(pelvis_z - (goal_z + 0.700)) <= 0.200

    lf_z = state.body('left_foot')[:, 2]
    rf_z = state.body('right_foot')[:, 2]
    feet_ok = (torch.min(lf_z, rf_z) - pelvis_z) >= 0.550

    up_dot = _up_dot_world_z(state)
    inverted_ok = up_dot <= -0.30

    lin = torch.linalg.vector_norm(state.root_lin_vel, dim=-1)
    ang = torch.linalg.vector_norm(state.root_ang_vel, dim=-1)
    speed_ok = (lin <= 0.350) & (ang <= 1.000)

    return hands_ok & pelvis_ok & feet_ok & inverted_ok & speed_ok


def failure(state):
    return state.fallen


def termination(state):
    return state.fallen


def reward_terms(state):
    goal = 'hand_support_region'
    left_app = _hand_approach(state, 'left_hand', goal)
    right_app = _hand_approach(state, 'right_hand', goal)
    hands_approach = 0.5 * (left_app + right_app)

    left_on = _xy_inside(state, 'left_hand', goal) * _bounded_contact(state, 'left_hand')
    right_on = _xy_inside(state, 'right_hand', goal) * _bounded_contact(state, 'right_hand')
    both_on = left_on * right_on

    up_dot = _up_dot_world_z(state)
    inversion_progress = torch.clamp((-up_dot), 0.0, 1.0)

    feet_rel = torch.min(state.body('left_foot')[:, 2], state.body('right_foot')[:, 2]) - state.body('pelvis')[:, 2]
    feet_over_pelvis_progress = torch.clamp((feet_rel + 0.76) / 1.46, 0.0, 1.0)

    target_pelvis = state.goal(goal)[:, 2] + 0.700
    pel_err = torch.abs(state.body('pelvis')[:, 2] - target_pelvis)
    pelvis_height_match = torch.exp(- (pel_err / 0.20) ** 2) * inversion_progress

    lin = torch.linalg.vector_norm(state.root_lin_vel, dim=-1)
    ang = torch.linalg.vector_norm(state.root_ang_vel, dim=-1)
    settled = torch.exp(-0.5 * (lin / 0.35) ** 2) * torch.exp(-0.5 * (ang / 1.0) ** 2) * both_on * inversion_progress

    return {
        'hands_approach': hands_approach,
        'left_on_target': left_on,
        'right_on_target': right_on,
        'both_hands_on_target': both_on,
        'inversion_progress': inversion_progress,
        'feet_over_pelvis_progress': feet_over_pelvis_progress,
        'pelvis_height_match': pelvis_height_match,
        'settled': settled,
    }


def reward(state):
    t = reward_terms(state)
    r = (
        0.12 * t['hands_approach'] +
        0.15 * t['left_on_target'] + 0.15 * t['right_on_target'] +
        0.08 * t['both_hands_on_target'] +
        0.18 * (t['inversion_progress'] * t['both_hands_on_target']) +
        0.22 * (t['feet_over_pelvis_progress'] * t['both_hands_on_target']) +
        0.18 * t['pelvis_height_match'] +
        0.07 * t['settled']
    )
    return torch.clamp(r, 0.0, 1.0)`
    }
  };

  var rewardTabs = Array.from(document.querySelectorAll("[data-reward-tab]"));
  var rewardCode = document.querySelector("[data-reward-code]");
  var rewardFilename = document.querySelector("[data-code-filename]");
  var copyCode = document.querySelector("[data-copy-code]");

  function selectReward(key, moveFocus) {
    var reward = rewards[key];
    if (!reward) return;
    rewardCode.textContent = reward.code;
    rewardFilename.textContent = reward.file;
    rewardTabs.forEach(function (tab) {
      var selected = tab.dataset.rewardTab === key;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) tab.focus();
    });
  }

  rewardTabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () { selectReward(tab.dataset.rewardTab, false); });
    tab.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      var direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      var next = (index + direction + rewardTabs.length) % rewardTabs.length;
      selectReward(rewardTabs[next].dataset.rewardTab, true);
    });
  });

  copyCode.addEventListener("click", function () {
    var text = rewardCode.textContent;
    var complete = function () {
      var label = copyCode.querySelector("span");
      label.textContent = "Copied";
      window.setTimeout(function () { label.textContent = "Copy"; }, 1400);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(complete);
      return;
    }

    var input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    complete();
  });

  var videoModal = document.querySelector("[data-video-modal]");
  if (videoModal) {
    var modalVideo = videoModal.querySelector("video");
    document.querySelector("[data-video-open]").addEventListener("click", function () {
      videoModal.showModal();
      var started = modalVideo.play();
      if (started) started.catch(function () {});
    });
    videoModal.addEventListener("click", function (event) {
      if (event.target === videoModal) videoModal.close();
    });
    videoModal.addEventListener("close", function () { modalVideo.pause(); });
  }

  selectReward("box-jump", false);
  console.assert(Object.keys(rewards).length === 6, "TRACC appendix reward manifest changed");
})();
