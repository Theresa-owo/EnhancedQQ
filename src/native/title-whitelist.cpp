#include <windows.h>
#include <node_api.h>
#include <cstring>
#include "MinHook.h"

// QQ passes a string view as a character pointer followed by its length.
struct CommandView { const char* data; size_t length; };
using CommandCheck = bool (*)(const CommandView*);
static CommandCheck original = nullptr;
static bool enabled = false;

using CreateInt = napi_status (NAPI_CDECL*)(napi_env, int32_t, napi_value*);
using CreateFunction = napi_status (NAPI_CDECL*)(napi_env, const char*, size_t, napi_callback, void*, napi_value*);
using SetProperty = napi_status (NAPI_CDECL*)(napi_env, napi_value, const char*, napi_value);
static CreateInt createInt = nullptr;
static CreateFunction createFunction = nullptr;
static SetProperty setProperty = nullptr;

static bool allowTitle(const CommandView* command) {
    static constexpr char title[] = "OidbSvcTrpcTcp.0x8fc_2";
    if (command && command->length == sizeof(title) - 1 &&
        std::memcmp(command->data, title, sizeof(title) - 1) == 0) return true;
    return original(command);
}

static napi_value result(napi_env env, int32_t code) {
    napi_value value = nullptr;
    return createInt(env, code, &value) == napi_ok ? value : nullptr;
}

#ifdef ENHANCEDQQ_TESTING
// Test builds map a copy of the QQ image without running its initialization.
static HMODULE testImage = nullptr;
static napi_value openTestImage(napi_env env, napi_callback_info) {
    if (!testImage) testImage = LoadLibraryExW(L"wrapper.node", nullptr, DONT_RESOLVE_DLL_REFERENCES);
    return result(env, testImage ? 0 : -10);
}
static napi_value probe(napi_env env, napi_callback_info) {
    if (!testImage) return result(env, -10);
    auto fn = reinterpret_cast<CommandCheck>(reinterpret_cast<unsigned char*>(testImage) + 0x76fb22);
    const char* words[] = {"OidbSvcTrpcTcp.0x8fc_2", "OidbSvcTrpcTcp.0x9149_1", "OidbSvcTrpcTcp.0x8fc_3"};
    int bits = 0;
    for (int i = 0; i < 3; ++i) {
        CommandView view{words[i], std::strlen(words[i])};
        if (fn(&view)) bits |= 1 << i;
    }
    return result(env, bits);
}
#endif

static napi_value install(napi_env env, napi_callback_info) {
    if (enabled) return result(env, 0);
#ifdef ENHANCEDQQ_TESTING
    auto image = testImage;
#else
    auto image = GetModuleHandleW(L"wrapper.node");
#endif
    if (!image) return result(env, -1);
    auto* candidate = reinterpret_cast<unsigned char*>(image) + 0x76fb22;
    // Only QQ 9.9.37-54395 is supported; JS also verifies the entire file hash.
    static const unsigned char signature[] = {
        0x56,0x48,0x83,0xec,0x20,0x49,0x89,0xc8,0x48,0x8d,0x0d,0xbf,0x12,0x9c,0x03,
        0x48,0x8d,0x35,0x68,0x18,0x9c,0x03,0x48,0x89,0xf2,0xe8,0x0c,0x00,0x00,0x00,
        0x48,0x39,0xf0,0x0f,0x95,0xc0,0x48,0x83,0xc4,0x20,0x5e,0xc3
    };
    if (std::memcmp(candidate, signature, sizeof(signature)) != 0) return result(env, -2);
    MH_STATUS status = MH_Initialize();
    if (status != MH_OK && status != MH_ERROR_ALREADY_INITIALIZED) return result(env, -3);
    status = MH_CreateHook(candidate, reinterpret_cast<void*>(&allowTitle), reinterpret_cast<void**>(&original));
    if (status != MH_OK) return result(env, -4);
    status = MH_EnableHook(candidate);
    if (status != MH_OK) { MH_RemoveHook(candidate); original = nullptr; return result(env, -5); }
    enabled = true;
    return result(env, 0);
}

extern "C" __declspec(dllexport) napi_value NAPI_CDECL napi_register_module_v1(napi_env env, napi_value exports) {
    HMODULE runtime = GetModuleHandleW(L"QQNT.dll");
    if (!runtime) runtime = GetModuleHandleW(nullptr);
    createInt = reinterpret_cast<CreateInt>(GetProcAddress(runtime, "napi_create_int32"));
    createFunction = reinterpret_cast<CreateFunction>(GetProcAddress(runtime, "napi_create_function"));
    setProperty = reinterpret_cast<SetProperty>(GetProcAddress(runtime, "napi_set_named_property"));
    if (!createInt || !createFunction || !setProperty) return nullptr;
    auto define = [&](const char* name, napi_callback callback) {
        napi_value value = nullptr;
        return createFunction(env, name, NAPI_AUTO_LENGTH, callback, nullptr, &value) == napi_ok &&
            setProperty(env, exports, name, value) == napi_ok;
    };
    if (!define("install", install)) return nullptr;
#ifdef ENHANCEDQQ_TESTING
    if (!define("openTestImage", openTestImage) || !define("probe", probe)) return nullptr;
#endif
    return exports;
}
