#include <raylib.h>
#include <raymath.h>
#include <rlgl.h>
#include <stdlib.h>
#include <time.h>
#include <math.h>

#if defined(PLATFORM_WEB)
#include <emscripten/emscripten.h>
#endif

typedef struct MovingCube {
    Vector3 pos;
    Vector3 velocity;
    Vector3 size;
    Vector3 rotationAxis;
    float rotationAngle;
    Color color;
    bool active;
} MovingCube;

#define MAX_CUBES 32
MovingCube spawnedCubes[MAX_CUBES] = {0};
float nextSpawnTime = 0.0f;
float lastTime = 0.0f;

static Vector3 main_cube_position;

const float GRAVITY = 9.8f;

float randf(float min, float max) {
    return min + ((float)rand() / (float)RAND_MAX) * (max - min);
}

void drawCubeRigid(MovingCube c) {
    rlPushMatrix();

    Matrix m = MatrixIdentity();
    m = MatrixMultiply(m, MatrixTranslate(c.pos.x, c.pos.y, c.pos.z));
    m = MatrixMultiply(m, MatrixRotate(c.rotationAxis, c.rotationAngle));
    m = MatrixMultiply(m, MatrixScale(c.size.x, c.size.y, c.size.z));

    rlMultMatrixf(MatrixToFloat(m));
    DrawCube((Vector3){0, 0, 0}, 1, 1, 1, c.color);
    DrawCubeWires((Vector3){0, 0, 0}, 1, 1, 1, DARKGRAY);
    rlPopMatrix();
}

void spawnCube(Camera cam) {
    for (int i = 0; i < MAX_CUBES; i++) {
        if (!spawnedCubes[i].active) {
            float cubeSize = randf(3.0f, 4.0f);
            spawnedCubes[i].size = (Vector3){cubeSize, cubeSize, cubeSize};
            spawnedCubes[i].color = rand() % 2 == 0 ? GRAY : RED;
            spawnedCubes[i].active = true;

            Vector3 forward = Vector3Normalize(Vector3Subtract(cam.target, cam.position));
            Vector3 right = Vector3Normalize(Vector3CrossProduct(forward, cam.up));
            Vector3 up = cam.up;

            float dist = randf(12.0f, 18.0f);

            float sideOffset = randf(-5.0f, 5.0f);
            float upOffset = randf(-1.0f, 3.0f);

            Vector3 pos = Vector3Add(cam.position, Vector3Scale(forward, dist));
            pos = Vector3Add(pos, Vector3Scale(right, sideOffset));
            pos = Vector3Add(pos, Vector3Scale(up, upOffset + 6.0f));

            spawnedCubes[i].pos = pos;

            spawnedCubes[i].velocity = Vector3Scale(Vector3Negate(forward), randf(4.0f, 6.0f));

            spawnedCubes[i].rotationAxis = Vector3Normalize((Vector3){randf(-1,1), randf(-1,1), randf(-1,1)});
            spawnedCubes[i].rotationAngle = 0.0f;
            break;
        }
    }
}


void updateCubes(Camera cam, float dt) {
    for (int i = 0; i < MAX_CUBES; i++) {
        if (!spawnedCubes[i].active) continue;

        spawnedCubes[i].velocity.y -= GRAVITY * dt;

        spawnedCubes[i].pos = Vector3Add(spawnedCubes[i].pos, Vector3Scale(spawnedCubes[i].velocity, dt));

        spawnedCubes[i].rotationAngle += Vector3Length(spawnedCubes[i].velocity) * dt;

        if (spawnedCubes[i].pos.y - spawnedCubes[i].size.y * 0.5f < 0.0f) {
            spawnedCubes[i].pos.y = spawnedCubes[i].size.y * 0.5f;
            spawnedCubes[i].velocity.y *= -0.3f;
            if (fabsf(spawnedCubes[i].velocity.y) < 1.0f)
                spawnedCubes[i].velocity.y = 0.0f;
        }

        float dist = Vector3Distance(cam.position, spawnedCubes[i].pos);
        if (dist > 80.0f)
            spawnedCubes[i].active = false;
    }
}

void DrawThickGrid(int size, float spacing, int thickness, Color color) {
    float half = size * spacing;

    for (int i = -size; i <= size; i++) {
        for (int t = 0; t < thickness; t++) {
            float offset = (t - thickness/2) * 0.02f;

            DrawLine3D((Vector3){-half, 0, i * spacing + offset},
                       (Vector3){half, 0, i * spacing + offset}, color);

            DrawLine3D((Vector3){i * spacing + offset, 0, -half},
                       (Vector3){i * spacing + offset, 0, half}, color);
        }
    }
}


void gameLoop(void *arg){
    Camera cam = *(Camera*)arg;
    float t = GetTime();
    float dt = t - lastTime;
    lastTime = t;

    if(t >= nextSpawnTime){
        spawnCube(cam);
        nextSpawnTime = t + randf(0.4f, 1.2f);
        TraceLog(LOG_INFO, "Spawned cube, next in %.2f seconds", nextSpawnTime - t);
    }

    updateCubes(cam, dt);

    BeginDrawing();
    ClearBackground(RAYWHITE);
    BeginMode3D(cam);

    DrawCube(main_cube_position,2,2,2,GRAY);
    DrawCubeWires(main_cube_position,2,2,2,DARKGRAY);

    for(int i=0;i<MAX_CUBES;i++){
        if(spawnedCubes[i].active) drawCubeRigid(spawnedCubes[i]);
    }

    DrawThickGrid(10, 1.0f, 3, GRAY);

    EndMode3D();
    
    // DrawText("0123456789", 10, 40, 20, DARKGRAY);
    DrawFPS(10, 10);
    EndDrawing();
}

int main(void){
    srand(time(NULL));
    int screenWidth = EM_ASM_INT({ return window.innerWidth; });
    int screenHeight = EM_ASM_INT({ return window.innerHeight; }) * 1.1;
    InitWindow(screenWidth,screenHeight,"Markofwitch");

    SetWindowState(FLAG_WINDOW_ALWAYS_RUN);

    Camera cam = {0};
    cam.position = (Vector3){10,10,10};
    cam.target = (Vector3){0,0,0};
    cam.up = (Vector3){0,1,0};
    cam.fovy = 45;
    cam.projection = CAMERA_PERSPECTIVE;

    main_cube_position = (Vector3){3.0f,2.0f,0.0f};

    lastTime = GetTime();

#if defined(PLATFORM_WEB)
    emscripten_set_main_loop_arg(gameLoop,&cam,0,1);
#else
    while(!WindowShouldClose()) gameLoop(&cam);
#endif

    CloseWindow();
    return 0;
}
