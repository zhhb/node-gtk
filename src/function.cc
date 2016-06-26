
#include "boxed.h"
#include "debug.h"
#include "function.h"
#include "value.h"
#include "gobject.h"
#include "gi.h"

#include <girffi.h>

using namespace v8;
using Nan::New;
using Nan::WeakCallbackType;

namespace GNodeJS {

static void FillArgument(GIArgInfo *arg_info,
                         GIArgument *argument,
                         Local<Value> value) {
    bool may_be_null = g_arg_info_may_be_null (arg_info);
    GITypeInfo type_info;
    g_arg_info_load_type (arg_info, &type_info);
    V8ToGIArgument(&type_info, argument, value, may_be_null);
}

static void AllocateArgument (GIBaseInfo *arg_info, GIArgument *argument) {
    gsize size;
    GITypeInfo arg_type;
    g_arg_info_load_type(arg_info, &arg_type);

    GITypeTag a_tag = g_type_info_get_tag(&arg_type);
    if (a_tag == GI_TYPE_TAG_INTERFACE) {
        GIInfoType i_type;
        GIBaseInfo *i_info;
        i_info = g_type_info_get_interface(&arg_type);
        i_type = g_base_info_get_type(i_info);

        if (i_type == GI_INFO_TYPE_STRUCT) {
            size = g_struct_info_get_size((GIStructInfo*)i_info);
        } else if (i_type == GI_INFO_TYPE_UNION) {
            size = g_union_info_get_size((GIUnionInfo*)i_info);
        } else if (i_type == GI_INFO_TYPE_INTERFACE) {
            g_warning("Allocate: arg %s \t interface %s",
                    g_base_info_get_name(arg_info),
                    g_base_info_get_name(i_info));
            size = g_struct_info_get_size(
                    g_interface_info_get_iface_struct(i_info));
        } else {
            DEBUG("arg OUT && caller-allocates && not supported: %s",
                    g_type_tag_to_string(a_tag));
            g_assert_not_reached();
        }

        argument->v_pointer = g_slice_alloc0(size);

        g_base_info_unref(i_info);
    } else {
        DEBUG("arg OUT && NOT INTERFACE: %s", g_type_tag_to_string(a_tag));
        g_assert_not_reached();
    }
}

/* see: /home/romgrk/src/gjs/gi/function.cpp */
void FunctionInvoker(const Nan::FunctionCallbackInfo<Value> &args) {
    //Isolate   *isolate = args.GetIsolate();
    FunctionInfo *func = (FunctionInfo *) External::Cast (*args.Data ())->Value ();

    GIBaseInfo *info = func->info;
    GError *error = NULL;

    int n_callable_args = g_callable_info_get_n_args ((GICallableInfo *) info);
    int n_total_args = n_callable_args;
    int n_out_args = 0;
    int n_in_args = 0;

    Parameter call_parameters[n_callable_args];

    for (int i = 0; i < n_callable_args; i++) {
        GIArgInfo arg_info;
        GITypeInfo type_info;
        g_callable_info_load_arg ((GICallableInfo *) info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &type_info);

        int array_length_idx = g_type_info_get_array_length (&type_info);
        if (array_length_idx >= 0) {
            call_parameters[i].type = Parameter::ARRAY;
            call_parameters[array_length_idx].type = Parameter::SKIP;
        }

        if (call_parameters[i].type == Parameter::SKIP)
            continue;

        if (g_arg_info_get_direction (&arg_info) == GI_DIRECTION_IN ||
            g_arg_info_get_direction (&arg_info) == GI_DIRECTION_INOUT)
            n_in_args++;
    }

    if (args.Length() < n_in_args) {
        Nan::ThrowTypeError(g_strdup_printf(
            "Not enough arguments; expected %i, have %i",
                n_in_args, args.Length()));
        return;
    }

    GIFunctionInfoFlags flags = g_function_info_get_flags (info);
    gboolean is_method = ((flags & GI_FUNCTION_IS_METHOD) != 0 &&
                          (flags & GI_FUNCTION_IS_CONSTRUCTOR) == 0);
    if (is_method)
        n_total_args++;

    gboolean can_throw = g_callable_info_can_throw_gerror (info);
    if (can_throw)
        n_total_args++;

    GIArgument total_arg_values[n_total_args];
    GIArgument *callable_arg_values;

    if (is_method) {
        GIBaseInfo *container = g_base_info_get_container (func->info);
        V8ToGIArgument(container, &total_arg_values[0], args.This() );
        callable_arg_values = &total_arg_values[1];
    } else {
        callable_arg_values = &total_arg_values[0];
    }

    int in_arg = 0, i = 0;
    for (; i < n_callable_args; i++) {
        if (call_parameters[i].type == Parameter::SKIP)
            continue;

        GIArgInfo arg_info = {};
        g_callable_info_load_arg ((GICallableInfo *) info, i, &arg_info);
        GIDirection direction = g_arg_info_get_direction (&arg_info);

        if (direction == GI_DIRECTION_OUT) {
            n_out_args++;

            if (g_arg_info_is_caller_allocates (&arg_info)) {
                AllocateArgument(&arg_info, &callable_arg_values[i]);
            } else /* is_callee_allocates */ {
                callable_arg_values[i].v_pointer = NULL;
            }
        }
        if (direction == GI_DIRECTION_IN || direction == GI_DIRECTION_INOUT) {
            /* Fill the in-argument if it is null and nullable */
            FillArgument(&arg_info, &callable_arg_values[i], args[in_arg]);

            if (call_parameters[i].type == Parameter::ARRAY) {
                GITypeInfo type_info;
                g_arg_info_load_type (&arg_info, &type_info);

                int array_length_pos = g_type_info_get_array_length (&type_info);
                GIArgInfo array_length_arg;
                g_callable_info_load_arg(info, array_length_pos, &array_length_arg);

                int array_length;
                //array_length = GetArrayLength (args[in_arg]);
                if (args[in_arg]->IsArray())
                    array_length = Local<Array>::Cast (args[in_arg]->ToObject ())->Length();
                else if (args[in_arg]->IsString())
                    array_length = Local<String>::Cast (args[in_arg]->ToObject ())->Length();
                else if (args[in_arg]->IsNull())
                    array_length = 0;
                else
                    g_assert_not_reached();

                Local<Value> array_length_value = New(array_length);
                FillArgument(
                        &array_length_arg,
                        &callable_arg_values[array_length_pos],
                        array_length_value);
            }
            in_arg++;
        }
        if (direction == GI_DIRECTION_INOUT) {
            WARN("FunctionInvoker: arg INOUT: %s ", g_base_info_get_name(&arg_info));
            WARN("Value: %s", *String::Utf8Value(args[in_arg]->ToString()) );
        }
    }

    if (can_throw)
        callable_arg_values[i].v_pointer = &error;

    void *ffi_arg_pointers[n_total_args];
    for (int i = 0; i < n_total_args; i++)
        ffi_arg_pointers[i] = &total_arg_values[i];

    GIArgument return_value;
    ffi_call (&func->invoker.cif, FFI_FN (func->invoker.native_address),
              &return_value, ffi_arg_pointers);


    GITypeInfo return_type;
    g_callable_info_load_return_type(info, &return_type);
    GITypeTag  return_tag      = g_type_info_get_tag(&return_type);
    GITransfer return_transfer = g_callable_info_get_caller_owns(info);

    //bool retValueLoaded = false;
    //FreeGIArgument(&return_type, &return_value);
    gboolean skip_return = g_callable_info_skip_return(info);
    //gboolean may_return_null = g_callable_info_may_return_null(info);
    if (return_transfer == GI_TRANSFER_NOTHING) {
        //if (skip_return == FALSE)
            //g_warning("Return: (transfer none) (no-skip!) %s ",
                //(may_return_null ? "(allow-none)" : ""));
    } else if (return_transfer == GI_TRANSFER_CONTAINER) {
        //g_warning("Return: (transfer container) %s ",
                //(may_return_null ? "(allow-none)" : ""));
    } else if (return_transfer == GI_TRANSFER_EVERYTHING) {
        //g_warning("Return: (transfer full) %s ",
            //(may_return_null ? "(allow-none)" : ""));
        //if (!may_return_null)
    }

    if (return_tag != GI_TYPE_TAG_VOID && (skip_return == FALSE))
        n_out_args++;

    for (int i = 0; i < n_callable_args; i++) {
        GIArgInfo  arg_info = {};
        GITypeInfo arg_type;
        GIDirection direction;
        g_callable_info_load_arg ((GICallableInfo *) info, i, &arg_info);
        g_arg_info_load_type (&arg_info, &arg_type);
        direction = g_arg_info_get_direction (&arg_info);

        if (direction == GI_DIRECTION_OUT) { //|| direction == GI_DIRECTION_INOUT)
            args.GetReturnValue().Set(
                    GIArgumentToV8(&arg_type, &callable_arg_values[i]) );
            //retValueLoaded = true;
        } else if (direction == GI_DIRECTION_INOUT) {
            // XXX is there something to do here?
            g_warning("INOUT: %s", g_base_info_get_name(&arg_info));
        } else {
            FreeGIArgument (&arg_type, &callable_arg_values[i]);
        }
    }

    if (error) {
        Nan::ThrowError(error->message);
        g_error_free(error);
        return;
    }

    if (return_tag != GI_TYPE_TAG_VOID)
        args.GetReturnValue().Set(
                GIArgumentToV8(&return_type, &return_value));

    //if (return_transfer == GI_TRANSFER_CONTAINER)
        //FreeGIArgument(&return_type, &return_value);
}

void FunctionDestroyed(const v8::WeakCallbackInfo<FunctionInfo> &data) {
    FunctionInfo *func = data.GetParameter ();
    g_base_info_unref (func->info);
    g_function_invoker_destroy (&func->invoker);
    g_free (func);
}

NAN_METHOD(FunctionInfoToString) {
    //Isolate *isolate = info.GetIsolate();
    FunctionInfo *func = (FunctionInfo *) External::Cast(*info.Holder());
    GIFunctionInfo *fn = func->info;
    GString *args_string = g_string_new("");

    int n_args = g_callable_info_get_n_args(fn);
    for (int i = 0; i < n_args; i++) {
        if (i != 0)
            g_string_append(args_string, ", ");
        GIArgInfo *arg_info = nullptr;
        arg_info = g_callable_info_get_arg(fn, i);
        g_string_append(args_string, g_base_info_get_name(arg_info));
        g_base_info_unref(arg_info);
    }

    gchar *args = g_string_free(args_string, FALSE);
    gchar *string = g_strdup_printf("function %s (%s) {}",
            g_function_info_get_symbol(fn),
            args);
    Local<String> result = UTF8(string);

    g_free(args);
    g_free(string);
    info.GetReturnValue().Set(result);
}

Local<Function> MakeFunction(GIBaseInfo *info) {
    FunctionInfo *func = g_new0 (FunctionInfo, 1);
    func->info = g_base_info_ref (info);
    g_function_info_prep_invoker (func->info, &func->invoker, NULL);
    auto tpl = New<FunctionTemplate>(FunctionInvoker, New<External>(func));

    Local<Function> fn = tpl->GetFunction();
    fn->SetName(
        New(g_function_info_get_symbol(info)).ToLocalChecked());

    Isolate *isolate = Isolate::GetCurrent();
    v8::Persistent<v8::FunctionTemplate> persistent(isolate, tpl);
    persistent.SetWeak(func, FunctionDestroyed, WeakCallbackType::kParameter);

    return fn;
}


#if 0
class TrampolineInfo {
    ffi_cif cif;
    ffi_closure *closure;
    Persistent<Function> persistent;
    GICallableInfo *info;
    GIScopeType scope_type;

    TrampolineInfo(Handle<Function>  function,
                   GICallableInfo   *info,
                   GIScopeType       scope_type);

    void Dispose();
    static void Call(ffi_cif *cif, void *result, void **args, void *data);
    void *GetClosure();
};

void TrampolineInfo::Dispose() {
    persistent = nullptr;
    g_base_info_unref (info);
    g_callable_info_free_closure (info, closure);
};

void TrampolineInfo::Call(ffi_cif *cif,
                          void *result,
                          void **args,
                          void *data) {
    TrampolineInfo *trampoline = (TrampolineInfo *) data;

    int argc = g_callable_info_get_n_args (trampoline->info);
    Handle<Value> argv[argc];

    for (int i = 0; i < argc; i++) {
        GIArgInfo arg_info;
        g_callable_info_load_arg (trampoline->info, i, &arg_info);
        GITypeInfo type_info;
        g_arg_info_load_type (&arg_info, &type_info);
        argv[i] = GIArgumentToV8 (&type_info, (GIArgument *) &args[i]);
    }

    Handle<Function> func = trampoline->func;
    /* Provide a bogus "this" function. Any interested callers should
     * bind their callbacks to what they're intersted in... */
    Handle<Object> this_obj = func;
    Handle<Value> return_value = func->Call (this_obj, argc, argv);
    GITypeInfo type_info;
    g_callable_info_load_return_type (trampoline->info, &type_info);
    V8ToGIArgument (&type_info, (GIArgument *) &result, return_value,
                    g_callable_info_may_return_null (trampoline->info));
}

TrampolineInfo::TrampolineInfo(Handle<Function>  function,
                               GICallableInfo   *info,
                               GIScopeType       scope_type) {
    this->closure = g_callable_info_prepare_closure (info, &cif, Call, this);
    this->func = Persistent<Function>::New (function);
    this->info = g_base_info_ref (info);
    this->scope_type = scope_type;
}
#endif

};
