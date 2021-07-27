const express = require("express");
const socket = require("socket.io");
const createError = require("http-errors");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { AwakeHeroku } = require("awake-heroku");
const { Socket } = require("dgram");
app.use(express.json());
// AwakeHeroku.add({
//   url: "https://exposium-api.herokuapp.com",
// });
//https://exposium-live-2021.web.app
//http://localhost:5000/
//https://exposium-api.herokuapp.com/
const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});
const requestList = {};
// const timeList = {}
const stallId = {};
const userId = {};
const userWantToConnect = {};
const stallSoIdToId = {};
const userSoIdToId = {};
const stallToConnect = {};
const userToConnect = {};
const userTimeStamp = {};
//end verb
io.on("connection", (socket) => {
  socket.on("send request to stall", (payload) => {
    try {
      userWantToConnect[payload.user] = payload.stall;
      if (!requestList[payload.stall]) {
        requestList[payload.stall] = [];
      }
      if (userId[payload.user]) {
        userId[payload.user] = socket.id;

        userSoIdToId[socket.id] = payload.user;
      } else {
        userId[payload.user] = socket.id;
        userSoIdToId[socket.id] = payload.user;
        userTimeStamp[payload.user] = payload.time;

        requestList[payload.stall]?.push(payload.user);

        if (stallId[payload.stall]) {
          io.to(stallId?.[payload.stall]).emit("already exited stall owner", {
            user: payload.user,
            time: payload.time,
          });
        }
      }
    } catch (error) {
      new Error(error);
    }
  });
  //for stall
  socket.on("requested list", (payload) => {
    try {
      stallId[payload.stall] = socket.id;
      stallSoIdToId[socket.id] = payload.stall;
      if (requestList?.[payload?.stall]) {
        socket.emit("list of the request", {
          list: requestList[payload.stall],
        });
      }
    } catch (error) {
      new Error(error);
    }
  });

  socket.on("sending signal", async (payload) => {
    try {
      const { userToSignal, callerID, signal, stall } = payload;
      // update stallSoIdToId

      delete stallSoIdToId[stallId[stall]];
      delete userWantToConnect[userToSignal];
      stallSoIdToId[socket.id] = stall;
      stallId[stall] = socket.id;
      stallToConnect[stall] = userToSignal;
      userToConnect[userToSignal] = stall;
      const userSocketId = await userId?.[userToSignal];
      io.to(userSocketId).emit("signal to user", {
        callerID,
        signal,
      });
    } catch (error) {
      new Error(error);
    }
  });

  socket.on("returning signal", async (payload) => {
    try {
      const { signal, stall } = payload;
      const stallSocketId = await stallId?.[stall];
      io.to(stallSocketId).emit("send signal to stall", { signal });
    } catch (error) {
      new Error(error);
    }
  });

  socket.on("call reject", (payload) => {
    try {
      const { stallId, rejectedId } = payload;
      const afterReject = requestList[stallId]?.filter(
        (id) => id !== rejectedId
      );
      requestList[stallId] = afterReject;
      io.to(userId[rejectedId]).emit("stall reject to user", "data");
    } catch (error) {
      new Error(error);
    }
  });
  //mic status
  socket.on("micro phone status", (payload) => {
    try {
      const { selfId, micStatus } = payload;
      if (stallToConnect[selfId]) {
        io.to(userId[stallToConnect[selfId]]).emit("send mic status to user", {
          micStatus,
        });
      } else if (userToConnect[selfId]) {
        io.to(stallId[userToConnect[selfId]]).emit("send mic status to stall", {
          micStatus,
        });
      } else {
        socket.emit("wait for connection", "audio");
      }
    } catch (error) {
      new Error(error);
    }
  });
  //mic end
  // video status
  socket.on("video status send", (payload) => {
    try {
      const { selfId, videoStatus } = payload;
      if (stallToConnect[selfId]) {
        io.to(userId[stallToConnect[selfId]]).emit(
          "send video status to user",
          {
            videoStatus,
          }
        );
      } else if (userToConnect[selfId]) {
        io.to(stallId[userToConnect[selfId]]).emit(
          "send video status to stall",
          {
            videoStatus,
          }
        );
      }
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("End call", (payload) => {
    try {
      const { selfId } = payload;
      if (stallToConnect[selfId]) {
        //stall
        const stillHave = requestList[selfId].filter(
          (id) => id !== stallToConnect[selfId]
        );
        requestList[selfId] = stillHave;
        const tempUserId = userId[stallToConnect[selfId]];
        delete userSoIdToId[userId[stallToConnect[selfId]]];
        delete userId[stallToConnect[selfId]];
        delete userToConnect[stallToConnect[selfId]];
        delete stallToConnect[selfId];
        io.to(tempUserId).emit("Disconnect call", "to user");
        socket.emit("you are disconnected", "self disconnected");
      }
      if (userId[selfId]) {
        if (userToConnect[selfId]) {
          const tempStallId = stallId[userToConnect[selfId]];
          const haveData = requestList[userToConnect[selfId]].filter(
            (id) => id !== selfId
          );
          requestList[userToConnect[selfId]] = haveData;
          delete userSoIdToId[userId[selfId]];
          delete userId[selfId];
          delete userToConnect[selfId];
          delete stallToConnect[userToConnect[selfId]];
          io.to(tempStallId).emit("Disconnect call", {
            haveData,
            userUuid: selfId,
          });
          socket.emit("you are disconnected", "self disconnected");
        } else {
          delete userSoIdToId[userId[selfId]];
          delete userWantToConnect[selfId];
          socket.emit("you are disconnected", "self disconnected");
        }
        socket.emit("you are disconnected", "self disconnected");
      }
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("no one connected disconnect", (payload) => {
    try {
      const { selfId, stall } = payload;
      delete userId[selfId];
      delete userSoIdToId[socket.id];

      if (userWantToConnect[selfId]) {
        const exitUser = requestList[userWantToConnect[selfId]].filter(
          (id) => id !== selfId
        );
        requestList[userWantToConnect[selfId]] = exitUser;
        delete userWantToConnect[selfId];
        io.to(stallId[stall]).emit("remove user", { newRequestList: exitUser });
      }

      //
      socket.emit("you are disconnected", "self disconnected");
    } catch (error) {
      new Error(error);
    }
  });

  //video status end
  //chat section
  socket.on("send message user", (payload) => {
    try {
      const { message, userSelf, date } = payload;

      io.to(stallId[userToConnect[userSelf]]).emit("receive message", {
        senderId: userSelf,
        message,
        hours: new Date().getHours(),
        minute: new Date().getMinutes(),
        year: new Date().getFullYear(),
        day: new Date().getDay(),
        month: new Date().getMonth(),
      });
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("send message stall", (payload) => {
    try {
      const { message, stallSelf, date } = payload;
      io.to(userId[stallToConnect[stallSelf]]).emit("receive message", {
        senderId: stallSelf,
        message,
        hours: new Date().getHours(),
        minute: new Date().getMinutes(),
        year: new Date().getFullYear(),
        day: new Date().getDay(),
        month: new Date().getMonth(),
      });
    } catch (error) {
      new Error(error);
    }
  });
  //chat section end

  socket.on("disconnect", () => {
    try {
      //stall disconnected
      if (stallSoIdToId[socket.id]) {
        delete stallId[stallSoIdToId[socket.id]];
        // stallToConnect[stallSoIdToId[socket.id]] = userToSignal;
        if (stallToConnect[stallSoIdToId[socket.id]]) {
          io.to(userId[stallToConnect[stallSoIdToId[socket.id]]]).emit(
            "stall owner disconnect call",
            "data"
          );
        }
        // delete userSoIdToId[userId[stallToConnect[stallSoIdToId[socket.id]]]];
        // delete userId[stallToConnect[stallSoIdToId[socket.id]]];
        // delete userToConnect[stallToConnect[stallSoIdToId[socket.id]]];
        delete stallToConnect[stallSoIdToId[socket.id]];
        delete stallSoIdToId[socket.id];
      }
      //user Disconnected
      if (userSoIdToId[socket.id]) {
        if (userToConnect[userSoIdToId[socket.id]]) {
          const withdrawUser = requestList[
            userToConnect?.[userSoIdToId?.[socket.id]]
          ]?.filter((id) => id !== userSoIdToId[socket.id]);
          requestList[userToConnect[userSoIdToId[socket.id]]] = withdrawUser;
          //request lit remove end
          io.to(stallId[userToConnect[userSoIdToId[socket.id]]]).emit(
            "User is disconnected",
            "data"
          );
          delete stallToConnect[userToConnect[userSoIdToId[socket.id]]];
          delete userToConnect[userSoIdToId[socket.id]];
          delete userId[userSoIdToId[socket.id]];
          delete userSoIdToId[socket.id];
        } else {
          delete userId[userSoIdToId[socket.id]];
          if (userWantToConnect[userSoIdToId[socket.id]]) {
            const exitRequest = requestList[
              userWantToConnect?.[userSoIdToId?.[socket.id]]
            ]?.filter((id) => id !== userSoIdToId[socket.id]);
            requestList[userWantToConnect[userSoIdToId[socket.id]]] =
              exitRequest;
            io.to(
              stallId?.[userWantToConnect?.[userSoIdToId?.[socket.id]]]
            ).emit("remove user", { newRequestList: exitRequest });
            //delete data
            delete userWantToConnect[userSoIdToId[socket.id]];
            delete userSoIdToId[socket.id];
          }
        }
      }
    } catch (error) {
      new Error(error);
    }
  });
});
//end //data send

// group video stream

const AUserIdToUid = {};
const AUserConnectedTo = {};
//
//latest

//new variab
const eventData = {};
const allUserData = {};

// const sUserConnectedTo={}
io.of("/group").on("connection", (socket, next) => {
  socket.on("member_join", (payload) => {
    try {
      const { eventId, memberUid, name } = payload;
      if (eventData[eventId]) {
        const filterData = eventData[eventId]?.filter(
          (id) => id.uid !== memberUid
        );

        socket.emit("older_member", { memberArray: filterData });
        filterData?.push({
          uid: memberUid,
          type: "member",
          soId: socket.id,
          name,
          audio: true,
          video: true,
        });
        eventData[eventId] = filterData;
      } else {
        eventData[eventId] = [];
        eventData[eventId]?.push({
          uid: memberUid,
          type: "member",
          soId: socket.id,
          name,
          audio: true,
          video: true,
        });
      }
      //all user Data
      allUserData[socket.id] = {
        uid: memberUid,
        type: "member",
        soId: socket.id,
        connectedEvent: eventId,
        name,
      };
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("member_send_signal", (payload) => {
    try {
      const { signal, sendToSoId, selfUid, type, eventUid, name } = payload;
      const data = eventData[eventUid]?.find((data) => data.uid === selfUid);
      if (type === "member") {
        socket.to(sendToSoId).emit("creat_peer_send_to_member", {
          signal,
          createPeerSenderUid: selfUid,
          peerSenderName: name,
          eventUid,
          audio: data.audio,
          video: data.video,
        });
      } else if (type === "user") {
        socket.to(sendToSoId).emit("send_other_user", {
          signal,
          createPeerSenderUid: selfUid,
          peerSenderName: name,
          eventUid,
          audio: data.audio,
          video: data.video,
        });
      }
    } catch (error) {
      new Error(error);
    }
  });

  socket.on("return_signal_to_createPeer_Sender", (payload) => {
    //from add peer receive
    try {
      const { signal, sendTo, selfUid, eventUid, name } = payload;
      const findData = eventData?.[eventUid]?.find((id) => id.uid === sendTo);
      const addPeerSenderDetails = eventData?.[eventUid]?.find(
        (id) => id.uid === selfUid
      );
      const str = {
        audio: true,
        video: true,
      };
      if (addPeerSenderDetails?.type === "member") {
        (str.audio = addPeerSenderDetails?.audio),
          (str.video = addPeerSenderDetails?.video);
      }
      socket.to(findData?.soId).emit("set_for_remote_description", {
        signal,
        addPeerSenderUid: selfUid,
        name,
        soId: socket.id,
        audio: str.audio,
        video: str.video,
      });
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("user_join", (payload) => {
    try {
      const { eventUid, uid, name } = payload;

      allUserData[socket.id] = {
        uid: uid,
        type: "user",
        soId: socket.id,
        connectedEvent: eventUid,
        name,
      };

      const memberOnly = eventData?.[eventUid]?.filter(
        (data) => data.type === "member"
      );
      // event is going on
      memberOnly?.forEach((user) => {
        socket.to(user.soId).emit("user_request_to_create_peer", {
          userUid: uid,
          name,
          soId: socket.id,
        });
      });

      const filterData = eventData?.[eventUid]?.filter((id) => id.uid !== uid);
      filterData?.push({
        uid,
        type: "user",
        soId: socket.id,
        name,
        audio: false,
        video: false,
      });
      eventData[eventUid] = filterData;
    } catch (error) {
      new Error(error);
    }
  });

  socket.on("make_loader_true", (payload) => {
    const { toSoId, uid } = payload;
    socket.to(toSoId).emit("true_loader_senderSide", { uid });
  });
  socket.on("disconnect", () => {
    try {
      const event = allUserData?.[socket.id]?.connectedEvent;
      const leaveUserUid = allUserData?.[socket.id]?.uid;
      if (allUserData[socket.id]) {
        if (allUserData[socket.id].type === "user") {
          const onlyMember = eventData[event]?.filter(
            (user) => user.type !== "user"
          );
          const exceptSelfUser = onlyMember?.filter(
            (id) => id.uid !== leaveUserUid
          );
          exceptSelfUser?.forEach((user) => {
            socket.to(user.soId).emit("user_leave", {
              leaveUid: leaveUserUid,
              name: allUserData?.[socket.id]?.name,
            });
          });
        } else if (allUserData[socket.id].type === "member") {
          const exceptHimself = eventData[event]?.filter(
            (id) => id.uid !== leaveUserUid
          );
          exceptHimself?.forEach((data) => {
            socket.to(data.soId).emit("this_member_leave", {
              leaveUid: leaveUserUid,
              name: allUserData?.[socket.id]?.name,
            });
          });
        }
      }
      delete allUserData[socket.id];
      const afterLeave = eventData[event]?.filter(
        (id) => id?.soId !== socket.id
      );
      eventData[event] = afterLeave;
    } catch (error) {
      new Error(error);
    }
  });
  //manual leave
  socket.on("one_member_leave", (payload) => {
    try {
      const { eventUid, leaveUserUid } = payload;
      const filterHimself = eventData[eventUid]?.filter(
        (id) => id.uid !== leaveUserUid
      );
      filterHimself?.forEach((user) => {
        socket.to(user.soId).emit("this_member_leave", {
          leaveUid: leaveUserUid,
        });
      });
      delete allUserData[socket.id];
      eventData[eventUid] = filterHimself;
    } catch (error) {
      new Error(error);
    }
  });
  //one user manualy leave himself
  socket.on("user_one_leave_himself", (payload) => {
    try {
      const { eventUid, userLeaveUid } = payload;
      const filterOnlyMember = eventData?.[eventUid]?.filter(
        (id) => id.type !== "user"
      );
      filterOnlyMember?.forEach((user) => {
        socket.to(user.soId).emit("user_leave", {
          leaveUid: userLeaveUid,
        });
      });
      delete allUserData[socket.id];
      eventData[eventUid] = eventData[eventUid]?.filter(
        (id) => id.uid !== userLeaveUid
      );
    } catch (error) {
      new Error(error);
    }
  });
  //mic and video toggle exchange
  socket.on("mute_mic", (payload) => {
    try {
      const { uid, eventUid, mic } = payload;
      const filterHimself = eventData[eventUid]?.filter((id) => id.uid !== uid);
      filterHimself?.forEach((user) => {
        socket.to(user.soId).emit("send_mic_status", { uid, mic });
      });
      allUserData[socket.id].audio = mic;
      const findUser = eventData[eventUid]?.find((id) => id.uid === uid);
      filterHimself?.push({
        uid,
        type: findUser.type,
        soId: findUser.soId,
        name: findUser.name,
        audio: mic,
        video: findUser.video,
      });
      eventData[eventUid] = filterHimself;
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("video_mute", (payload) => {
    try {
      const { uid, eventUid, video } = payload;
      const filterHimself = eventData[eventUid]?.filter((id) => id.uid !== uid);
      filterHimself?.forEach((user) => {
        socket.to(user.soId).emit("send_video_status", { uid, video });
      });
      allUserData[socket.id].video = video;
      const findUser = eventData[eventUid]?.find((id) => id.uid === uid);
      filterHimself?.push({
        uid,
        type: findUser.type,
        soId: findUser.soId,
        name: findUser.name,
        audio: findUser.audio,
        video: video,
      });
      eventData[eventUid] = filterHimself;
    } catch (error) {
      new Error(error);
    }
  });

  //message services
  socket.on("message_send_to_All_user", (payload) => {
    try {
      const { userUid, eventUid, name, text, record } = payload;
      const removeHimself = eventData[eventUid]?.filter(
        (id) => id.uid !== userUid
      );
      removeHimself?.forEach((user) => {
        socket.to(user.soId).emit("message_receive", {
          senderUid: userUid,
          name,
          text,
          date: new Date(),
          record,
        });
      });
    } catch (error) {
      new Error(error);
    }
  });
});

const groupRequest = {};
const memberData = {};
const groupConnectedArray = {};
//groupUpdate
io.of("/groupUpdate").on("connection", (socket, next) => {
  socket.on("sendRequest_members", (payload) => {
    //initiat request by host
    try {
      const { hostId, membersId, name } = payload;
      if (groupRequest[hostId]) {
        membersId?.forEach((id) => {
          const check = groupRequest[hostId]?.find((data) => data === id);

          if (!check) {
            groupRequest[hostId]?.push(id);
            if (memberData[id]) {
              socket
                .to(memberData?.[id]?.soId)
                .emit("member_request_true", { request: true }); //meeting all data
            }
          }
        });
      } else {
        //if host room is not present
        groupRequest[hostId] = [];
        groupRequest[hostId] = membersId;
        groupConnectedArray[hostId]?.push({
          uid: hostId,
          soId: socket.id,
          audio: true,
          video: true,
          type: "host",
          name,
        });
      }
    } catch (error) {
      new Error(error);
    }
  });
  //check member he is belong to request list or not
  socket.on("check_he_is_requested", (payload) => {
    try {
      const { hostId, memberId, name } = payload;
      if (groupRequest[hostId]) {
        const check = groupRequest[hostId]?.find((id) => id === memberId);

        if (check) {
          //check he is requested or not
          socket.emit("member_request_true", { request: true }); //meeting all data
        }
      }
      // still do not have host only speaker member record here
      memberData[memberId] = {
        uid: memberId,
        name,
        soId: socket.id,
      };
      //
    } catch (error) {
      new Error(error);
    }
  });

  // speakerMember in room
  socket.on("speaker_member_in_room", (payload) => {
    try {
      const { hostId, speakerUid } = payload;
      groupConnectedArray[hostId];
      // groupConnectedArray
      const exceptHost = groupConnectedArray?.[hostId]?.filter(
        (id) => id.uid !== hostId
      );
      socket.emit("list_of_connected", { inGroup: exceptHost });
    } catch (error) {
      new Error(error);
    }
  });
}); // end group update

//network part
//room
const tableRoom = {};
//waiting user
const waitingRoom = {};
const waitMemberConnected = {};
const waitMemberSoIdToUid = {};

//tablemember
const memberConnected = {};
const memberSoIdToUid = {};
//code
io.of("/network").on("connection", (socket, next) => {
  //table join
  socket.on("table_admin_join", (payload, next) => {
    try {
      const { tableNo, uid, name } = payload;
      tableRoom[tableNo] = [];
      waitingRoom[tableNo] = [];
      tableRoom[tableNo].push({
        uid,
        type: "host",
        audio: true,
        video: true,
        soId: socket.id,
        name,
      });
      memberConnected[uid] = tableNo;
      memberSoIdToUid[socket.id] = uid;
    } catch (error) {
      console.log(error);
    }
  });
  //disconnect  part
  socket.on("disconnect", () => {
    const uid = memberSoIdToUid?.[socket.id];
    const connectTable = memberConnected?.[uid];
    const waitCandidateUid = waitMemberSoIdToUid?.[socket.id];
    const waitConnectTable = waitMemberConnected?.[waitCandidateUid];

    if (tableRoom[connectTable]) {
      const findTable = tableRoom?.[connectTable].find(
        (user) => user.uid === uid
      );
      if (findTable?.type === "host") {
        tableRoom?.[connectTable]?.forEach((user) => {
          socket.to(user.soId).emit("host_has_leave", "disconnect all");
        });
        delete tableRoom[connectTable];
        delete memberSoIdToUid[socket.id];
        delete memberConnected[uid];
        delete waitingRoom[connectTable];
      } else {
        const filterHimSelf = tableRoom?.[connectTable]?.filter(
          (user) => user.uid !== uid
        );
        filterHimSelf.forEach((id) => {
          socket.to(id.soId).emit("user_send_user_disconnect", { uid });
        });
        tableRoom[connectTable] = filterHimSelf;

        delete memberSoIdToUid[socket.id];
        delete memberConnected[uid];
      }
    } else if (waitCandidateUid) {
      //waitConnectTable
      const hostData = tableRoom?.[waitConnectTable]?.find(
        (id) => id.type === "host"
      );
      const hostId = hostData?.soId;
      const waitData = waitingRoom[waitConnectTable].filter(
        (id) => id.uid !== waitCandidateUid
      );
      socket
        .to(hostId)
        .emit("one_waiter_remove", { waitCandidateUid, waiterArray: waitData });

      waitingRoom[waitConnectTable] = waitData;
      delete waitMemberSoIdToUid[socket.id];
      delete waitMemberConnected[waitCandidateUid];
    } else {
      //not possible
      delete memberSoIdToUid[socket.id];
      delete memberConnected[uid];
    }
  });
  // triger to leave
  socket.on("one_member_take_leave", (payload, next) => {
    try {
      const { uid } = payload;
      const connectTable = memberConnected?.[uid];
      if (tableRoom[connectTable]) {
        const findTable = tableRoom?.[connectTable].find(
          (user) => user.uid === uid
        );
        if (findTable.type === "host") {
          tableRoom?.[connectTable]?.forEach((user) => {
            socket.to(user.soId).emit("host_has_leave", "disconnect all");
          });
          delete tableRoom[connectTable];
          delete memberSoIdToUid[socket.id];
          delete memberConnected[uid];
          delete waitingRoom[connectTable];
        } else {
          const filterHimSelf = tableRoom?.[connectTable]?.filter(
            (user) => user.uid !== uid
          );
          tableRoom?.[connectTable]?.forEach((id) => {
            socket.to(id.soId).emit("user_send_user_disconnect", { uid });
          });
          tableRoom[connectTable] = filterHimSelf;

          delete memberSoIdToUid[socket.id];
          delete memberConnected[uid];
        }
      } else {
        //not possible
        delete memberSoIdToUid[socket.id];
        delete memberConnected[uid];
      }
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("host_remove_user", (payload, next) => {
    try {
      const { uid } = payload;
      // const memberSoIdToUid = {};
      const table = memberConnected[uid];
      const members = tableRoom[table];
      const user = members?.find((id) => id.uid === uid);
      const userSoId = user.soId;
      const remove = tableRoom[table]?.filter((data) => data.uid !== uid);
      tableRoom[table]?.forEach((element) => {
        if (element.uid === uid) {
          socket
            .to(element.soId)
            .emit("host_has_leave", "you_are_removed_by_host");
        } else if (element.type === "user") {
          socket.to(element.soId).emit("user_send_user_disconnect", { uid });
        }
      });
      tableRoom[table] = remove;
      delete memberSoIdToUid[userSoId];
      delete memberConnected[uid];
    } catch (error) {
      new Error(error);
    }
  });
  //disconnect end

  //user request
  socket.on("table_user_request_join", (payload, next) => {
    try {
      const { tableNo, uid, name } = payload;
      if (tableRoom[tableNo]) {
        if (tableRoom[tableNo].length == 4) {
          //Table is full
          const findHost = tableRoom[tableNo].find((id) => id.type === "host");
          waitingRoom[tableNo].push({
            type: "wait",
            uid: uid,
            soId: socket.id,
            name,
          });
          waitMemberConnected[uid] = tableNo;
          waitMemberSoIdToUid[socket.id] = uid;
          socket
            .to(findHost.soId)
            .emit("waiting_room", { waitingList: waitingRoom[tableNo] });
        } else {
          const findHost = tableRoom[tableNo].find((id) => id.type === "host");
          socket.to(findHost.soId).emit("one_user_request", {
            userUid: uid,
            soId: socket.id,
            name,
          });
        }
      } else {
        socket.emit("yor_table_not_ready", "not ready table");
        // Table is not present
      }
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("Admin_accept", (payload, next) => {
    try {
      const { userUid, soId, tableNo, name } = payload;
      socket
        .to(soId)
        .emit("send_to_user_for_signal", { usersList: tableRoom[tableNo] });
      const userData = {
        uid: userUid,
        type: "user",
        audio: true,
        video: true,
        soId: soId,
        name,
      };
      tableRoom[tableNo].push(userData);
      memberConnected[userUid] = tableNo;
      memberSoIdToUid[soId] = userUid;
    } catch (error) {
      new Error(error);
    }
  });

  socket.on("user_send_signal_to_host", (payload, next) => {
    try {
      const { signal, sendToSoId, uid, name, video, audio } = payload;
      socket.to(sendToSoId).emit("send_signal_to_host", {
        signal,
        senderId: socket.id,
        senderUid: uid,
        name,
        video,
        audio,
      });
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("Signal_return_from_host", (payload, next) => {
    try {
      const { signal, senderUid, senderId, name, tableNo } = payload;
      const userData = tableRoom[tableNo]?.find((id) => id.uid === senderUid);
      socket.to(senderId).emit("returned_signal_to_user", {
        signal,
        senderUid,
        name,
        audio: userData?.audio,
        video: userData?.video,
      });
    } catch (error) {
      new Error(error);
    }
  });
  // user send signal other users
  socket.on("user_send_signal_user", (payload, next) => {
    try {
      const { signal, sendToSoId, uid, name, video, audio } = payload;
      socket.to(sendToSoId).emit("user_send_signal_other_user", {
        signal,
        senderUid: uid,
        soId: socket.id,
        name,
        video,
        audio,
      });
    } catch (error) {
      new Error(error);
    }
  });
  //signal come from user after addPeer
  socket.on("Signal_goes_to_user", (payload, next) => {
    try {
      const { signal, senderUid, senderId, tableNo } = payload;
      const userData = tableRoom?.[tableNo]?.find((id) => id.uid === senderUid);
      socket.to(senderId).emit("returned_signal_to_user", {
        signal,
        senderUid,
        audio: userData?.audio,
        video: userData?.video,
      });
    } catch (error) {
      new Error(error);
    }
  });
  //message section
  socket.on("One_user_send_message", (payload, next) => {
    try {
      const { uid, name, text, status, textUid, table, record } = payload;
      const exceptSender = tableRoom?.[table]?.filter((id) => id.uid !== uid);
      exceptSender?.forEach((user) => {
        socket
          .to(user.soId)
          .emit("message_send", { uid, name, text, status, record, textUid });
      });
    } catch (error) {
      new Error(error);
    }
  });
  socket.on("typing", (payload, next) => {
    try {
      const { name, table, uid } = payload;
      const exceptSender = tableRoom?.[table]?.filter((id) => id.uid !== uid);
      exceptSender?.forEach((user) => {
        socket.to(user.soId).emit("typing_status", { name, uid });
      });
    } catch (error) {
      new Error(error);
    }
  });
  //mute status
  socket.on("mic_off", (payload) => {
    try {
      const { micStatus, tableNo, uid } = payload;
      const dataUpdate = tableRoom?.[tableNo]?.find((id) => id.uid === uid);
      const userData = {
        uid: dataUpdate.uid,
        type: dataUpdate.type,
        audio: micStatus,
        video: dataUpdate.video,
        soId: dataUpdate.soId,
        name: dataUpdate.name,
      };
      // uid,
      //   type: "host",
      //   audio: true,
      //   video: true,
      //   soId: socket.id,
      //   name,
      const filterData = tableRoom?.[tableNo]?.filter((id) => id.uid !== uid);
      filterData.forEach((user) => {
        socket
          .to(user.soId)
          .emit("mic_status_send", { senderUid: uid, micStatus });
      });
      filterData?.push(userData);
      tableRoom[tableNo] = filterData;
    } catch (error) {
      new Error(error);
    }
  });
  //video
  socket.on("video_off", (payload) => {
    try {
      const { videoStatus, tableNo, uid } = payload;
      const dataUpdate = tableRoom?.[tableNo]?.find((id) => id.uid === uid);
      const userData = {
        uid: dataUpdate.uid,
        type: dataUpdate.type,
        audio: dataUpdate.audio,
        video: videoStatus,
        soId: dataUpdate.soId,
        name: dataUpdate.name,
      };

      const filterData = tableRoom?.[tableNo]?.filter((id) => id.uid !== uid);
      filterData.forEach((user) => {
        socket
          .to(user.soId)
          .emit("video_status_send", { senderUid: uid, videoStatus });
      });
      filterData?.push(userData);
      tableRoom[tableNo] = filterData;
    } catch (error) {
      new Error(error);
    }
  });

  //end network
});

//group chat
const groupChatUIDToId = {};
const groupChatIdToUid = {};

io.of("/groupChat").on("connection", (socket, next) => {
  socket.on("new_user_Join", (payload) => {
    const { uid } = payload;
    if (groupChatUIDToId[uid]) {
      delete groupChatIdToUid[groupChatUIDToId[uid]];
      delete groupChatUIDToId[uid];
      groupChatUIDToId[uid] = socket.id;
      groupChatIdToUid[socket.id] = uid;
    } else {
      groupChatUIDToId[uid] = socket.id;
      groupChatIdToUid[socket.id] = uid;
    }
  });
  socket.on("send_message", (payload) => {
    const {
      groupId,
      sendToArray,
      sender,
      text,
      name,
      flag,
      imageFile,
      record,
      reaction,
      textUid,
    } = payload;
    sendToArray?.forEach((uid) => {
      if (groupChatUIDToId[uid]) {
        socket.to(groupChatUIDToId[uid]).emit("receive_to_data", {
          groupId,
          senderUid: sender,
          text,
          name,
          flag,
          imageFile,
          record,

          textUid,
          reaction,
        });
      }
    });
  });
  socket.on("reaction _return", (payload) => {
    const { sendArray, textUid, selectOne, groupId, clickByDetails } = payload;
    sendArray?.forEach((uid) => {
      if (groupChatUIDToId[uid]) {
        socket.to(groupChatUIDToId[uid]).emit("return_reaction", {
          textUid,
          selectOne,
          groupId,
          clickByDetails,
        });
      }
    });
  });
  //end chat
});

app.use(async (req, res, next) => {
  next(createError.NotFound());
});

app.use((err, req, res, next) => {
  res.status(err.status || 400);
  res.send({
    error: {
      status: err.status || 400,
      message: err.message,
    },
  });
});
server.listen(process.env.PORT || 5000, () => {
  console.log("5000 port ready to start");
});
// share .//not work
